package validator

import (
	"fmt"
	"strings"

	v10 "github.com/go-playground/validator/v10"
)

var validate *v10.Validate

type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

func init() {
	validate = v10.New()
}

func ValidateStruct(s interface{}) []ValidationError {
	err := validate.Struct(s)
	if err == nil {
		return nil
	}
	var errs []ValidationError
	for _, e := range err.(v10.ValidationErrors) {
		errs = append(errs, ValidationError{
			Field:   toSnakeCase(e.Field()),
			Message: formatMessage(e),
		})
	}
	return errs
}

func formatMessage(e v10.FieldError) string {
	field := toSnakeCase(e.Field())
	switch e.Tag() {
	case "required":
		return fmt.Sprintf("%s is required", field)
	case "min":
		return fmt.Sprintf("%s must be at least %s characters", field, e.Param())
	case "max":
		return fmt.Sprintf("%s must be at most %s characters", field, e.Param())
	case "len":
		return fmt.Sprintf("%s must be exactly %s characters", field, e.Param())
	case "numeric":
		return fmt.Sprintf("%s must contain only digits", field)
	case "oneof":
		return fmt.Sprintf("%s must be one of: %s", field, e.Param())
	default:
		return fmt.Sprintf("%s failed %s validation", field, e.Tag())
	}
}

func toSnakeCase(s string) string {
	var result strings.Builder
	for i, r := range s {
		if r >= 'A' && r <= 'Z' {
			if i > 0 {
				result.WriteRune('_')
			}
			result.WriteRune(r + 32)
		} else {
			result.WriteRune(r)
		}
	}
	return result.String()
}
