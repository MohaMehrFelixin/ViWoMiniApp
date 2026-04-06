package finnotech

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"go.uber.org/zap"
)

// NIDResult represents the national ID verification result.
type NIDResult struct {
	Verified bool   `json:"verified"`
	Message  string `json:"message,omitempty"`
}

// VerifyNID verifies a person's identity using their national code, name, birth date, and gender.
func (c *Client) VerifyNID(ctx context.Context, nationalCode, fullName, birthDate, gender, trackID string) (*NIDResult, error) {
	c.logger.Info("finnotech: NID verification",
		zap.String("national_code", maskNID(nationalCode)),
	)

	auth, err := c.bearerAuth()
	if err != nil {
		return nil, fmt.Errorf("finnotech: NID auth failed: %w", err)
	}

	// Split full name into first + last
	nameParts := strings.Fields(fullName)
	firstName := nameParts[0]
	lastName := ""
	if len(nameParts) > 1 {
		lastName = strings.Join(nameParts[1:], " ")
	}

	params := url.Values{}
	params.Set("trackId", trackID)
	params.Set("birthDate", birthDate)
	params.Set("fullName", fullName)
	params.Set("firstName", firstName)
	params.Set("lastName", lastName)
	params.Set("gender", gender)

	reqURL := fmt.Sprintf("%s/credit/v2/clients/%s/users/%s/nidVerification?%s",
		c.baseURL, c.clientID, nationalCode, params.Encode())

	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("finnotech: build NID request failed: %w", err)
	}
	req.Header.Set("Authorization", auth)

	var resp struct {
		Result struct {
			IsValid bool   `json:"isValid"`
			Message string `json:"message"`
		} `json:"result"`
	}
	if err := c.doJSON(req, &resp); err != nil {
		return nil, err
	}

	return &NIDResult{
		Verified: resp.Result.IsValid,
		Message:  resp.Result.Message,
	}, nil
}
