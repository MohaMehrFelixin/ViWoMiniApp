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

// Provider status constants.
const (
	ProviderStatusPending   = "pending"
	ProviderStatusApproved  = "approved"
	ProviderStatusRejected  = "rejected"
	ProviderStatusSuspended = "suspended"
)

// Provider role constants.
const (
	ProviderRoleDistributor    = "distributor"
	ProviderRoleServiceProvider = "service_provider"
)

// Admin-defined service types (rows in provider_service_types).
type ProviderServiceType struct {
	ID          int64     `json:"id"`
	Code        string    `json:"code"`
	Name        string    `json:"name"`
	NameFa      string    `json:"name_fa"`
	Description string    `json:"description"`
	Role        string    `json:"role"`
	IsActive    bool      `json:"is_active"`
	SortOrder   int       `json:"sort_order"`
	CreatedAt   time.Time `json:"created_at"`
}

// Provider represents a distributor or service provider.
// The same Telegram user may also have a Household row for their own coupons.
type Provider struct {
	ID                  int64            `json:"id"`
	TelegramUserID      int64            `json:"telegram_user_id"`
	HouseholdID         *int64           `json:"household_id,omitempty"`
	Name                string           `json:"name"`
	NameFa              string           `json:"name_fa"`
	NationalCode        *string          `json:"national_code,omitempty"`
	ServiceTypeID       int64            `json:"service_type_id"`
	StoreAddress        string           `json:"store_address"`
	StoreAddressFa      string           `json:"store_address_fa"`
	StoreDescription    string           `json:"store_description"`
	Lat                 float64          `json:"lat"`
	Lng                 float64          `json:"lng"`
	DistributionPointID *int64           `json:"distribution_point_id,omitempty"`
	AllowedCategories   []CouponCategory `json:"allowed_categories"`
	Status              string           `json:"status"`
	ApprovedAt          *time.Time       `json:"approved_at,omitempty"`
	ApprovedBy          *int64           `json:"approved_by,omitempty"`
	RejectedReason      *string          `json:"rejected_reason,omitempty"`
	SuspendedReason     *string          `json:"suspended_reason,omitempty"`
	CreatedAt           time.Time        `json:"created_at"`
	UpdatedAt           time.Time        `json:"updated_at"`
}

// ProviderSession records a work shift (open → close).
type ProviderSession struct {
	ID              int64      `json:"id"`
	ProviderID      int64      `json:"provider_id"`
	OpenedAt        time.Time  `json:"opened_at"`
	ClosedAt        *time.Time `json:"closed_at,omitempty"`
	DurationMinutes int        `json:"duration_minutes"`
	CreatedAt       time.Time  `json:"created_at"`
}

// ProviderTransaction records a single distribution event from the provider's perspective.
type ProviderTransaction struct {
	ID                int64          `json:"id"`
	ProviderID        int64          `json:"provider_id"`
	RedemptionID      *int64         `json:"redemption_id,omitempty"`
	HouseholdID       int64          `json:"household_id"`
	Category          CouponCategory `json:"category"`
	Amount            string         `json:"amount"`
	ItemDescription   string         `json:"item_description"`
	ItemDescriptionFa string         `json:"item_description_fa"`
	CreatedAt         time.Time      `json:"created_at"`
}

// Provider aggregate stats.
type ProviderCategoryStat struct {
	Category    CouponCategory `json:"category"`
	Count       int            `json:"count"`
	TotalAmount string         `json:"total_amount"`
}

type ProviderDayStats struct {
	Transactions int                    `json:"transactions"`
	ByCategory   []ProviderCategoryStat `json:"by_category"`
}

type ProviderTotalStats struct {
	Transactions int                    `json:"transactions"`
	DaysWorked   int                    `json:"days_worked"`
	TotalHours   float64                `json:"total_hours"`
	ByCategory   []ProviderCategoryStat `json:"by_category"`
}

type ProviderStats struct {
	Today          ProviderDayStats   `json:"today"`
	Total          ProviderTotalStats `json:"total"`
	CurrentSession *ProviderSession   `json:"current_session"`
}

// --- Catalog / Item-level allocation models ---

// CatalogUnit is an admin-defined measurement unit (kg, g, L, pcs, cans, ...).
type CatalogUnit struct {
	ID     int64  `json:"id"`
	Code   string `json:"code"`
	Name   string `json:"name"`
	NameFa string `json:"name_fa"`
}

// CatalogItem is an admin-defined product/service within a coupon category.
type CatalogItem struct {
	ID            int64          `json:"id"`
	Category      CouponCategory `json:"category"`
	UnitID        int64          `json:"unit_id"`
	Name          string         `json:"name"`
	NameFa        string         `json:"name_fa"`
	Icon          string         `json:"icon"`
	Scope         string         `json:"scope"`           // "national" or "regional"
	Region        *string        `json:"region,omitempty"` // nil for national
	DefaultAmount string         `json:"default_amount"`
	SortOrder     int            `json:"sort_order"`
	IsActive      bool           `json:"is_active"`
}

// CatalogItemWithUnit is CatalogItem joined with its unit for API responses.
type CatalogItemWithUnit struct {
	CatalogItem
	Unit CatalogUnit `json:"unit"`
}

// HouseholdItemAllocation tracks per-item allocation and usage for a household.
type HouseholdItemAllocation struct {
	ID              int64     `json:"id"`
	HouseholdID     int64     `json:"household_id"`
	CatalogItemID   int64     `json:"catalog_item_id"`
	CycleStart      time.Time `json:"cycle_start"`
	CycleEnd        time.Time `json:"cycle_end"`
	AllocatedAmount string    `json:"allocated_amount"`
	UsedAmount      string    `json:"used_amount"`
	Status          string    `json:"status"`
}

// ItemAllocationView is the frontend-friendly joined view of item + unit + allocation.
type ItemAllocationView struct {
	ItemID          int64  `json:"item_id"`
	Category        string `json:"category"`
	Name            string `json:"name"`
	NameFa          string `json:"name_fa"`
	Icon            string `json:"icon"`
	Scope           string `json:"scope"`
	Region          string `json:"region,omitempty"`
	UnitCode        string `json:"unit_code"`
	UnitName        string `json:"unit_name"`
	UnitNameFa      string `json:"unit_name_fa"`
	AllocatedAmount string `json:"allocated_amount"`
	UsedAmount      string `json:"used_amount"`
}

// API response types for catalog endpoints.
type CatalogItemsResponse struct {
	Items []CatalogItemWithUnit `json:"items"`
}

type ItemAllocationsResponse struct {
	National []ItemAllocationView `json:"national"`
	Regional []ItemAllocationView `json:"regional"`
}

// --- Product Offering models ---

// ProductOfferingStatus constants.
const (
	OfferingStatusPending    = "pending"
	OfferingStatusReviewing  = "reviewing"
	OfferingStatusContacted  = "contacted"
	OfferingStatusAccepted   = "accepted"
	OfferingStatusRejected   = "rejected"
	OfferingStatusCollected  = "collected"
)

// ProductOffering is a citizen's offer to contribute products to crisis relief.
type ProductOffering struct {
	ID             int64      `json:"id"`
	HouseholdID    int64      `json:"household_id"`
	TelegramUserID int64      `json:"telegram_user_id"`
	ProductName    string     `json:"product_name"`
	ProductNameFa  string     `json:"product_name_fa"`
	Quantity       string     `json:"quantity"`
	Unit           string     `json:"unit"`
	Description    string     `json:"description"`
	Status         string     `json:"status"`
	AdminNotes     string     `json:"admin_notes,omitempty"`
	ReviewedBy     *int64     `json:"reviewed_by,omitempty"`
	ReviewedAt     *time.Time `json:"reviewed_at,omitempty"`
	ContactedAt    *time.Time `json:"contacted_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type SubmitProductOfferingsRequest struct {
	Offerings []ProductOfferingItem `json:"offerings" validate:"required,min=1,max=20"`
}

type ProductOfferingItem struct {
	ProductName   string `json:"product_name" validate:"required,max=200"`
	ProductNameFa string `json:"product_name_fa" validate:"max=200"`
	Quantity      string `json:"quantity" validate:"required"`
	Unit          string `json:"unit" validate:"required,max=20"`
	Description   string `json:"description" validate:"max=500"`
}

type ProductOfferingsResponse struct {
	Offerings []ProductOffering `json:"offerings"`
}

// --- Support Ticket models ---

const (
	TicketStatusOpen       = "open"
	TicketStatusInProgress = "in_progress"
	TicketStatusResolved   = "resolved"
	TicketStatusClosed     = "closed"

	TicketPriorityNormal = "normal"
	TicketPriorityHigh   = "high"
	TicketPriorityUrgent = "urgent"
)

type SupportTicket struct {
	ID             int64      `json:"id"`
	HouseholdID    int64      `json:"household_id"`
	TelegramUserID int64      `json:"telegram_user_id"`
	Category       string     `json:"category"`
	Priority       string     `json:"priority"`
	Subject        string     `json:"subject"`
	Description    string     `json:"description"`
	ReferenceCode  *string    `json:"reference_code,omitempty"`
	Status         string     `json:"status"`
	AssignedTo     *int64     `json:"assigned_to,omitempty"`
	ResolvedAt     *time.Time `json:"resolved_at,omitempty"`
	ResolutionNote *string    `json:"resolution_note,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type TicketReply struct {
	ID         int64     `json:"id"`
	TicketID   int64     `json:"ticket_id"`
	AuthorType string    `json:"author_type"` // "user" or "admin"
	AuthorID   int64     `json:"author_id"`
	Message    string    `json:"message"`
	CreatedAt  time.Time `json:"created_at"`
}

type SubmitTicketRequest struct {
	Category      string `json:"category" validate:"required,oneof=coupon_issue account_issue app_bug data_correction corruption_report critical_report"`
	Priority      string `json:"priority" validate:"required,oneof=normal high urgent"`
	Subject       string `json:"subject" validate:"required,min=3,max=200"`
	Description   string `json:"description" validate:"required,min=10,max=2000"`
	ReferenceCode string `json:"reference_code" validate:"max=100"`
}

type TicketsResponse struct {
	Tickets []SupportTicket `json:"tickets"`
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

// --- Provider Request / Response DTOs ---

type RegisterProviderRequest struct {
	ServiceTypeCode  string  `json:"service_type_code" validate:"required,max=50"`
	StoreAddress     string  `json:"store_address" validate:"required,max=500"`
	StoreAddressFa   string  `json:"store_address_fa" validate:"max=500"`
	StoreDescription string  `json:"store_description" validate:"required,max=1000"`
	Lat              float64 `json:"lat"`
	Lng              float64 `json:"lng"`
}

// ProviderProfileResponse is returned by GET /provider/profile.
// The frontend uses "type" and "service_type" rather than IDs.
type ProviderProfileResponse struct {
	Provider ProviderProfileDTO `json:"provider"`
}

type ProviderProfileDTO struct {
	ID                  int64  `json:"id"`
	Name                string `json:"name"`
	NameFa              string `json:"name_fa"`
	Type                string `json:"type"`          // "distributor" or "service_provider"
	ServiceType         string `json:"service_type"`  // code from provider_service_types
	Status              string `json:"status"`
	StoreAddress        string `json:"store_address"`
	StoreAddressFa      string `json:"store_address_fa"`
	DistributionPointID int64  `json:"distribution_point_id"`
	CreatedAt           string `json:"created_at"`
}

type ProviderSessionResponse struct {
	Session *ProviderSession `json:"session"`
}

type ProviderStatsResponse struct {
	Stats *ProviderStats `json:"stats"`
}

type ProviderServiceTypesResponse struct {
	ServiceTypes []ProviderServiceType `json:"service_types"`
}
