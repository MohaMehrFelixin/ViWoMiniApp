package model

import (
	"strings"
	"time"
)

// NormalizePersianDigits converts Persian/Arabic numerals to Western digits.
func NormalizePersianDigits(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		switch {
		case r >= '۰' && r <= '۹':
			b.WriteRune('0' + (r - '۰'))
		case r >= '٠' && r <= '٩':
			b.WriteRune('0' + (r - '٠'))
		default:
			b.WriteRune(r)
		}
	}
	return b.String()
}

type CouponCategory string

const (
	CategoryWater   CouponCategory = "water"
	CategoryFood    CouponCategory = "food"
	CategoryFuel    CouponCategory = "fuel"
	CategoryHygiene CouponCategory = "hygiene"
	CategoryMedical CouponCategory = "medical"
	CategoryEnergy  CouponCategory = "energy"
)

func (c CouponCategory) IsValid() bool {
	switch c {
	case CategoryWater, CategoryFood, CategoryFuel, CategoryHygiene, CategoryMedical, CategoryEnergy:
		return true
	}
	return false
}

func AllCategories() []CouponCategory {
	return []CouponCategory{CategoryWater, CategoryFood, CategoryFuel, CategoryHygiene, CategoryMedical, CategoryEnergy}
}

// KYC tier constants.
const (
	KYCTierDigital     = 1
	KYCTierSemiOffline = 2
	KYCTierFullOffline = 3
)

// Location segment constants.
const (
	LocationSegmentTehran = "tehran"
	LocationSegmentUrban  = "urban"
	LocationSegmentRural  = "rural"
)

// Status constants.
const (
	HouseholdStatusActive    = "active"
	HouseholdStatusSuspended = "suspended"
	HouseholdStatusPending   = "pending"

	AllocationStatusActive   = "active"
	AllocationStatusExpired  = "expired"
	AllocationStatusExhausted = "exhausted"

	RedemptionStatusPending   = "pending"
	RedemptionStatusCompleted = "completed"
	RedemptionStatusDisputed  = "disputed"
	RedemptionStatusReversed  = "reversed"
)

// Age group constants.
const (
	AgeGroupInfant0to6m  = "infant_0_6m"
	AgeGroupInfant6to23m = "infant_6_23m"
	AgeGroupChild2to4    = "child_2_4"
	AgeGroupChild5to11   = "child_5_11"
	AgeGroupTeen12to17   = "teen_12_17"
	AgeGroupAdult18to59  = "adult_18_59"
	AgeGroupSenior60to64 = "senior_60_64"
	AgeGroupElderly65p   = "elderly_65_plus"
)

// Domain types.

type Household struct {
	ID              int64     `json:"id"`
	TelegramUserID  int64     `json:"telegram_user_id"`
	HouseholdCode   string    `json:"household_code"`
	KYCTier         int       `json:"kyc_tier"`
	PhoneNumber     string    `json:"phone_number,omitempty"`
	Address         string    `json:"address"`
	Lat             float64   `json:"lat"`
	Lng             float64   `json:"lng"`
	ProvinceCode    string    `json:"province_code"`
	LocationSegment string    `json:"location_segment"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type HouseholdMember struct {
	ID           int64     `json:"id"`
	HouseholdID  int64     `json:"household_id"`
	NationalCode string    `json:"national_code"`
	FullName     string    `json:"full_name"`
	BirthDate    time.Time `json:"birth_date"`
	Gender       string    `json:"gender"`
	Relationship string    `json:"relationship"`
	AgeGroup     string    `json:"age_group"`
	SpecialFlags []string  `json:"special_flags"`
	KYCVerified  bool      `json:"kyc_verified"`
	CreatedAt    time.Time `json:"created_at"`
}

type CouponAllocation struct {
	ID                int64          `json:"id"`
	HouseholdID       int64          `json:"household_id"`
	Category          CouponCategory `json:"category"`
	CycleStart        time.Time      `json:"cycle_start"`
	CycleEnd          time.Time      `json:"cycle_end"`
	TotalAmount       string         `json:"total_amount"`
	UsedAmount        string         `json:"used_amount"`
	RemainingAmount   string         `json:"remaining_amount"`
	WeeklyReleasePcts [4]int         `json:"weekly_release_pcts"`
	CurrentWeek       int            `json:"current_week"`
	Status            string         `json:"status"`
	CreatedAt         time.Time      `json:"created_at"`
}

type CouponRedemption struct {
	ID                  int64          `json:"id"`
	HouseholdID         int64          `json:"household_id"`
	AllocationID        int64          `json:"allocation_id"`
	Category            CouponCategory `json:"category"`
	Amount              string         `json:"amount"`
	CouponCode          string         `json:"coupon_code"`
	DistributionPointID int64          `json:"distribution_point_id"`
	RedeemedByMemberID  int64          `json:"redeemed_by_member_id"`
	QRNonce             string         `json:"qr_nonce"`
	Status              string         `json:"status"`
	CreatedAt           time.Time      `json:"created_at"`
}

type DistributionCenter struct {
	ID             int64            `json:"id"`
	Name           string           `json:"name"`
	Type           string           `json:"type"`
	Address        string           `json:"address"`
	Lat            float64          `json:"lat"`
	Lng            float64          `json:"lng"`
	Categories     []CouponCategory `json:"categories"`
	OperatingHours string           `json:"operating_hours"`
	QueueMinutes   int              `json:"queue_minutes"`
	StockStatus    map[string]string `json:"stock_status"`
	ProvinceCode   string           `json:"province_code"`
	Status         string           `json:"status"`
	CreatedAt      time.Time        `json:"created_at"`
	UpdatedAt      time.Time        `json:"updated_at"`
}

type QRPayload struct {
	HouseholdID int64          `json:"household_id"`
	Category    CouponCategory `json:"category"`
	Amount      string         `json:"amount"`
	CouponCode  string         `json:"coupon_code"`
	IssuedAt    time.Time      `json:"issued_at"`
	ExpiresAt   time.Time      `json:"expires_at"`
	Signature   string         `json:"signature"`
	Tier        int            `json:"tier"`
	Nonce       string         `json:"nonce"`
}

// Request DTOs.

type RegisterHouseholdRequest struct {
	NationalCode string  `json:"national_code" validate:"required,len=10,numeric"`
	FullName     string  `json:"full_name" validate:"required,min=2,max=200"`
	BirthDate    string  `json:"birth_date" validate:"required"`
	Gender       string  `json:"gender" validate:"required,oneof=male female other"`
	Mobile       string  `json:"mobile" validate:"required,len=11"`
	Address      string  `json:"address" validate:"required,max=500"`
	Lat          float64 `json:"lat"`
	Lng          float64 `json:"lng"`
	KYCTrackID   string  `json:"kyc_track_id"`
}

type AddMemberRequest struct {
	NationalCode string   `json:"national_code" validate:"required,len=10,numeric"`
	FullName     string   `json:"full_name" validate:"required,min=2,max=200"`
	BirthDate    string   `json:"birth_date" validate:"required"`
	Gender       string   `json:"gender" validate:"required,oneof=male female other"`
	Relationship string   `json:"relationship" validate:"required,max=50"`
	SpecialFlags []string `json:"special_flags" validate:"omitempty,dive,oneof=pregnant chronic disability newborn sanitary"`
}

type GenerateQRRequest struct {
	Category string `json:"category" validate:"required,oneof=water food fuel hygiene medical energy"`
	Amount   string `json:"amount" validate:"required"`
}

type RedeemRequest struct {
	QRData              string `json:"qr_data" validate:"required"`
	DistributionPointID int64  `json:"distribution_point_id" validate:"required"`
}

type DisputeRequest struct {
	Reason string `json:"reason" validate:"required,min=10,max=1000"`
}

type SendOTPRequest struct {
	Mobile       string `json:"mobile" validate:"required,len=11"`
	NationalCode string `json:"national_code" validate:"required,len=10,numeric"`
}

type VerifyOTPRequest struct {
	Mobile       string `json:"mobile" validate:"required,len=11"`
	NationalCode string `json:"national_code" validate:"required,len=10,numeric"`
	OTP          string `json:"otp" validate:"required,len=6,numeric"`
	TrackID      string `json:"track_id" validate:"required"`
}

type VerifyIdentityRequest struct {
	NationalCode string `json:"national_code" validate:"required,len=10,numeric"`
	FullName     string `json:"full_name" validate:"required,min=2,max=200"`
	BirthDate    string `json:"birth_date" validate:"required"`
	Gender       string `json:"gender" validate:"required,oneof=male female other"`
	Mobile       string `json:"mobile" validate:"required,len=11"`
	TrackID      string `json:"track_id" validate:"required"`
}

// Response DTOs.

type CategoryBalanceResponse struct {
	Category        CouponCategory `json:"category"`
	TotalAmount     string         `json:"total_amount"`
	UsedAmount      string         `json:"used_amount"`
	RemainingAmount string         `json:"remaining_amount"`
	AvailableNow    string         `json:"available_now"`
	CurrentWeek     int            `json:"current_week"`
	CycleStart      time.Time      `json:"cycle_start"`
	CycleEnd        time.Time      `json:"cycle_end"`
	Status          string         `json:"status"`
}

type AllBalancesResponse struct {
	HouseholdID int64                     `json:"household_id"`
	Balances    []CategoryBalanceResponse `json:"balances"`
}

type HouseholdSummaryResponse struct {
	Household   *Household        `json:"household"`
	MemberCount int               `json:"member_count"`
	Members     []HouseholdMember `json:"members"`
}

type GenerateQRResponse struct {
	QRData  string     `json:"qr_data"`
	Payload *QRPayload `json:"payload"`
}

type MembersResponse struct {
	Members []HouseholdMember `json:"members"`
}

type RedemptionHistoryResponse struct {
	Redemptions []CouponRedemption `json:"redemptions"`
	NextCursor  string             `json:"next_cursor"`
}

type NearbyDistributionCentersResponse struct {
	Centers []DistributionCenter `json:"centers"`
}

type DisputeResponse struct {
	Message string `json:"message"`
}

var WeeklyReleasePcts = [4]int{35, 25, 25, 15}

// Power Bank Swap constants.
const (
	SwapStatusPending   = "pending"
	SwapStatusReady     = "ready"
	SwapStatusPickedUp  = "picked_up"
	SwapStatusReturned  = "returned"
	SwapStatusCancelled = "cancelled"
)

type PowerBankSwap struct {
	ID          int64      `json:"id"`
	HouseholdID int64      `json:"household_id"`
	MemberID    int64      `json:"member_id"`
	Status      string     `json:"status"`
	SwapCode    string     `json:"swap_code"`
	CenterID    *int64     `json:"center_id,omitempty"`
	PickedUpAt  *time.Time `json:"picked_up_at,omitempty"`
	ReturnedAt  *time.Time `json:"returned_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type RequestSwapRequest struct {
	CenterID int64 `json:"center_id" validate:"required"`
}

type PowerBankSwapResponse struct {
	Swap    *PowerBankSwap `json:"swap"`
	Message string         `json:"message,omitempty"`
}

type PowerBankSwapsResponse struct {
	Swaps      []PowerBankSwap `json:"swaps"`
	ActiveSwap *PowerBankSwap  `json:"active_swap,omitempty"`
}
