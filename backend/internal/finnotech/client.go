package finnotech

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"go.uber.org/zap"
)

// Client is the Finnotech HTTP API client.
type Client struct {
	baseURL      string
	clientID     string
	clientSecret string
	redirectURI  string
	httpClient   *http.Client
	logger       *zap.Logger

	// Token cache
	mu          sync.RWMutex
	accessToken string
	tokenExpiry time.Time

	// Circuit breaker
	cbMu            sync.Mutex
	consecutiveFail int
	cbOpenUntil     time.Time
}

// NewClient creates a Finnotech API client.
func NewClient(baseURL, clientID, clientSecret, redirectURI string, logger *zap.Logger) *Client {
	return &Client{
		baseURL:      strings.TrimRight(baseURL, "/"),
		clientID:     clientID,
		clientSecret: clientSecret,
		redirectURI:  redirectURI,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		logger: logger,
	}
}

// basicAuth returns the Basic auth header value.
func (c *Client) basicAuth() string {
	creds := c.clientID + ":" + c.clientSecret
	return "Basic " + base64.StdEncoding.EncodeToString([]byte(creds))
}

// bearerAuth returns the Bearer auth header using cached token.
func (c *Client) bearerAuth() (string, error) {
	c.mu.RLock()
	if c.accessToken != "" && time.Now().Before(c.tokenExpiry) {
		token := c.accessToken
		c.mu.RUnlock()
		return "Bearer " + token, nil
	}
	c.mu.RUnlock()

	// Need to refresh
	if err := c.refreshToken(); err != nil {
		return "", err
	}

	c.mu.RLock()
	defer c.mu.RUnlock()
	return "Bearer " + c.accessToken, nil
}

// refreshToken gets a new client credentials token from Finnotech.
func (c *Client) refreshToken() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Double-check after acquiring write lock
	if c.accessToken != "" && time.Now().Before(c.tokenExpiry.Add(-5*time.Minute)) {
		return nil
	}

	body := fmt.Sprintf(
		`{"grant_type":"client_credentials","nid":"%s","scopes":"facility:shahkar:get"}`,
		c.clientID,
	)

	req, err := http.NewRequest("POST", c.baseURL+"/dev/v2/oauth2/token", strings.NewReader(body))
	if err != nil {
		return fmt.Errorf("finnotech: token request build failed: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", c.basicAuth())

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("finnotech: token request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return &APIError{StatusCode: resp.StatusCode, Code: "TOKEN_ERROR", Message: string(respBody)}
	}

	var result struct {
		Result struct {
			Value string `json:"value"`
		} `json:"result"`
		LifeTime int64 `json:"lifeTime"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("finnotech: token decode failed: %w", err)
	}

	c.accessToken = result.Result.Value
	if result.LifeTime > 0 {
		c.tokenExpiry = time.Now().Add(time.Duration(result.LifeTime) * time.Second)
	} else {
		c.tokenExpiry = time.Now().Add(30 * time.Minute)
	}

	c.logger.Info("finnotech: access token refreshed",
		zap.Time("expires_at", c.tokenExpiry),
	)
	return nil
}

// checkCircuitBreaker returns an error if the circuit is open.
func (c *Client) checkCircuitBreaker() error {
	c.cbMu.Lock()
	defer c.cbMu.Unlock()
	if c.consecutiveFail >= 5 && time.Now().Before(c.cbOpenUntil) {
		return ErrServiceUnavailable
	}
	if time.Now().After(c.cbOpenUntil) {
		c.consecutiveFail = 0
	}
	return nil
}

func (c *Client) recordSuccess() {
	c.cbMu.Lock()
	c.consecutiveFail = 0
	c.cbMu.Unlock()
}

func (c *Client) recordFailure() {
	c.cbMu.Lock()
	c.consecutiveFail++
	if c.consecutiveFail >= 5 {
		c.cbOpenUntil = time.Now().Add(30 * time.Second)
		c.logger.Warn("finnotech: circuit breaker opened", zap.Int("failures", c.consecutiveFail))
	}
	c.cbMu.Unlock()
}

// doJSON performs an HTTP request and decodes the JSON response.
func (c *Client) doJSON(req *http.Request, out interface{}) error {
	if err := c.checkCircuitBreaker(); err != nil {
		return err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		c.recordFailure()
		return fmt.Errorf("finnotech: request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		c.recordFailure()
		return fmt.Errorf("finnotech: read response failed: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		c.recordFailure()
		return &APIError{
			StatusCode: resp.StatusCode,
			Code:       fmt.Sprintf("HTTP_%d", resp.StatusCode),
			Message:    string(respBody),
		}
	}

	c.recordSuccess()
	if out != nil {
		if err := json.Unmarshal(respBody, out); err != nil {
			return fmt.Errorf("finnotech: decode response failed: %w", err)
		}
	}
	return nil
}

// maskPhone masks a phone number for logging: 091***4567
func maskPhone(phone string) string {
	if len(phone) < 7 {
		return "***"
	}
	return phone[:3] + "***" + phone[len(phone)-4:]
}

// maskNID masks a national code for logging: 007***8901
func maskNID(nid string) string {
	if len(nid) < 7 {
		return "***"
	}
	return nid[:3] + "***" + nid[len(nid)-4:]
}
