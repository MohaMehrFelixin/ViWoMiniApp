package finnotech

import (
	"context"
	"fmt"
	"net/http"
	"net/url"

	"go.uber.org/zap"
)

// ShahkarResult represents the Shahkar mobile-national code match result.
type ShahkarResult struct {
	Matched bool `json:"matched"`
}

// MatchMobileNID verifies that a mobile number is registered to the given national code
// using the Shahkar service.
func (c *Client) MatchMobileNID(ctx context.Context, mobile, nationalCode, trackID string) (*ShahkarResult, error) {
	c.logger.Info("finnotech: shahkar matching",
		zap.String("mobile", maskPhone(mobile)),
		zap.String("national_code", maskNID(nationalCode)),
	)

	auth, err := c.bearerAuth()
	if err != nil {
		return nil, fmt.Errorf("finnotech: shahkar auth failed: %w", err)
	}

	params := url.Values{}
	params.Set("mobile", mobile)
	params.Set("nationalCode", nationalCode)
	params.Set("trackId", trackID)

	reqURL := fmt.Sprintf("%s/facility/v2/clients/%s/shahkar/verify?%s",
		c.baseURL, c.clientID, params.Encode())

	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("finnotech: build shahkar request failed: %w", err)
	}
	req.Header.Set("Authorization", auth)

	var resp struct {
		Result struct {
			IsValid bool `json:"isValid"`
		} `json:"result"`
	}
	if err := c.doJSON(req, &resp); err != nil {
		return nil, err
	}

	return &ShahkarResult{Matched: resp.Result.IsValid}, nil
}
