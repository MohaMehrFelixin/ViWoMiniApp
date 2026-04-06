package finnotech

import (
	"context"
	"fmt"
	"net/http"
	"net/url"

	"go.uber.org/zap"
)

// SendOTPResponse is the response from the OTP send endpoint.
type SendOTPResponse struct {
	TrackID string `json:"trackId"`
}

// VerifyOTPResponse is the response from the OTP verify endpoint.
type VerifyOTPResponse struct {
	Code string `json:"code"` // authorization code for token exchange
}

// SendOTP sends an OTP SMS to the given mobile number.
func (c *Client) SendOTP(ctx context.Context, mobile string) (*SendOTPResponse, error) {
	c.logger.Info("finnotech: sending OTP",
		zap.String("mobile", maskPhone(mobile)),
	)

	params := url.Values{}
	params.Set("client_id", c.clientID)
	params.Set("response_type", "code")
	params.Set("redirect_uri", c.redirectURI)
	params.Set("scope", "facility:shahkar:get")
	params.Set("mobile", mobile)
	params.Set("auth_type", "SMS")

	reqURL := fmt.Sprintf("%s/dev/v2/oauth2/authorize?%s", c.baseURL, params.Encode())
	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("finnotech: build OTP request failed: %w", err)
	}
	req.Header.Set("Authorization", c.basicAuth())

	var resp struct {
		Result struct {
			TrackID string `json:"trackId"`
		} `json:"result"`
	}
	if err := c.doJSON(req, &resp); err != nil {
		return nil, err
	}

	return &SendOTPResponse{TrackID: resp.Result.TrackID}, nil
}

// VerifyOTP verifies the OTP code and returns an authorization code.
func (c *Client) VerifyOTP(ctx context.Context, mobile, nationalCode, otp, trackID string) (*VerifyOTPResponse, error) {
	c.logger.Info("finnotech: verifying OTP",
		zap.String("mobile", maskPhone(mobile)),
		zap.String("national_code", maskNID(nationalCode)),
		zap.String("track_id", trackID),
	)

	body := fmt.Sprintf(
		`{"otp":"%s","mobile":"%s","nid":"%s","trackId":"%s"}`,
		otp, mobile, nationalCode, trackID,
	)

	req, err := http.NewRequestWithContext(ctx, "POST",
		c.baseURL+"/dev/v2/oauth2/verify",
		stringReader(body),
	)
	if err != nil {
		return nil, fmt.Errorf("finnotech: build verify request failed: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", c.basicAuth())

	var resp struct {
		Result struct {
			Code string `json:"code"`
		} `json:"result"`
	}
	if err := c.doJSON(req, &resp); err != nil {
		return nil, err
	}

	return &VerifyOTPResponse{Code: resp.Result.Code}, nil
}
