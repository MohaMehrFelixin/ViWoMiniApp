package repository

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	couponModel "github.com/viwo-app/mini-coupon/internal/coupon/model"
)

// EntityRepository provides admin-level read/write access to all coupon system entities.
// This supplements the existing coupon repositories with paginated listing, search,
// status management, and admin-specific write operations.
type EntityRepository struct {
	pool *pgxpool.Pool
}

func NewEntityRepository(pool *pgxpool.Pool) *EntityRepository {
	return &EntityRepository{pool: pool}
}

// ─── Households ───

// ListHouseholds returns paginated households filtered by status, search, and
// the admin's province scope. Empty `provinceScope` means global access (CEO/CTO).
func (r *EntityRepository) ListHouseholds(ctx context.Context, search string, status string, provinceScope []string, offset, limit int) ([]couponModel.Household, int, error) {
	where := "1=1"
	args := []interface{}{}
	argN := 1

	if status != "" {
		where += fmt.Sprintf(" AND status = $%d", argN)
		args = append(args, status)
		argN++
	}
	if search != "" {
		where += fmt.Sprintf(" AND (household_code ILIKE $%d OR address ILIKE $%d OR CAST(telegram_user_id AS TEXT) LIKE $%d)", argN, argN, argN)
		args = append(args, "%"+search+"%")
		argN++
	}
	// Province scoping: if provinceScope is non-empty, restrict to those provinces.
	// Empty scope means the admin is global (L9-10) and sees everything.
	if len(provinceScope) > 0 {
		where += fmt.Sprintf(" AND province_code = ANY($%d)", argN)
		args = append(args, provinceScope)
		argN++
	}

	var total int
	countArgs := make([]interface{}, len(args))
	copy(countArgs, args)
	if err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM households WHERE "+where, countArgs...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("entity_repo: count households: %w", err)
	}

	query := fmt.Sprintf("SELECT id, telegram_user_id, household_code, kyc_tier, address, lat, lng, province_code, location_segment, status, created_at, updated_at FROM households WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d", where, argN, argN+1)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("entity_repo: list households: %w", err)
	}
	defer rows.Close()

	var out []couponModel.Household
	for rows.Next() {
		var h couponModel.Household
		if err := rows.Scan(&h.ID, &h.TelegramUserID, &h.HouseholdCode, &h.KYCTier, &h.Address, &h.Lat, &h.Lng, &h.ProvinceCode, &h.LocationSegment, &h.Status, &h.CreatedAt, &h.UpdatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, h)
	}
	return out, total, nil
}

func (r *EntityRepository) GetHouseholdDetail(ctx context.Context, id int64) (*couponModel.Household, []couponModel.HouseholdMember, error) {
	var h couponModel.Household
	err := r.pool.QueryRow(ctx, "SELECT id, telegram_user_id, household_code, kyc_tier, address, lat, lng, province_code, location_segment, status, created_at, updated_at FROM households WHERE id = $1", id).
		Scan(&h.ID, &h.TelegramUserID, &h.HouseholdCode, &h.KYCTier, &h.Address, &h.Lat, &h.Lng, &h.ProvinceCode, &h.LocationSegment, &h.Status, &h.CreatedAt, &h.UpdatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil, nil
	}
	if err != nil {
		return nil, nil, err
	}

	rows, err := r.pool.Query(ctx, "SELECT id, household_id, national_code, full_name, birth_date, gender, relationship, age_group, special_flags, kyc_verified, created_at FROM household_members WHERE household_id = $1", id)
	if err != nil {
		return &h, nil, err
	}
	defer rows.Close()

	var members []couponModel.HouseholdMember
	for rows.Next() {
		var m couponModel.HouseholdMember
		if err := rows.Scan(&m.ID, &m.HouseholdID, &m.NationalCode, &m.FullName, &m.BirthDate, &m.Gender, &m.Relationship, &m.AgeGroup, &m.SpecialFlags, &m.KYCVerified, &m.CreatedAt); err != nil {
			return &h, nil, err
		}
		members = append(members, m)
	}
	return &h, members, nil
}

func (r *EntityRepository) UpdateHouseholdStatus(ctx context.Context, id int64, status, reason string) error {
	query := "UPDATE households SET status = $2, suspension_reason = $3"
	if status == "suspended" {
		query += ", suspended_at = NOW()"
	}
	query += " WHERE id = $1"
	tag, err := r.pool.Exec(ctx, query, id, status, reason)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("household not found")
	}
	return nil
}

// ─── Redemptions ───

func (r *EntityRepository) ListRedemptions(ctx context.Context, status, category string, offset, limit int) ([]couponModel.CouponRedemption, int, error) {
	where := "1=1"
	args := []interface{}{}
	argN := 1

	if status != "" {
		where += fmt.Sprintf(" AND status = $%d", argN)
		args = append(args, status)
		argN++
	}
	if category != "" {
		where += fmt.Sprintf(" AND category = $%d", argN)
		args = append(args, category)
		argN++
	}

	var total int
	countArgs := make([]interface{}, len(args))
	copy(countArgs, args)
	if err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM coupon_redemptions WHERE "+where, countArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := fmt.Sprintf("SELECT id, household_id, allocation_id, category, amount, coupon_code, distribution_point_id, redeemed_by_member_id, qr_nonce, status, created_at FROM coupon_redemptions WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d", where, argN, argN+1)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var out []couponModel.CouponRedemption
	for rows.Next() {
		var rd couponModel.CouponRedemption
		if err := rows.Scan(&rd.ID, &rd.HouseholdID, &rd.AllocationID, &rd.Category, &rd.Amount, &rd.CouponCode, &rd.DistributionPointID, &rd.RedeemedByMemberID, &rd.QRNonce, &rd.Status, &rd.CreatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, rd)
	}
	return out, total, nil
}

func (r *EntityRepository) ResolveDispute(ctx context.Context, tx pgx.Tx, redemptionID int64, accepted bool, resolution string, adminID int64) error {
	newStatus := "completed"
	if accepted {
		newStatus = "reversed"
	}
	query := `UPDATE coupon_redemptions SET status = $2, dispute_resolution = $3, dispute_resolved_by = $4, dispute_resolved_at = NOW() WHERE id = $1 AND status = 'disputed'`
	tag, err := tx.Exec(ctx, query, redemptionID, newStatus, resolution, adminID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("redemption not found or not disputed")
	}
	return nil
}

func (r *EntityRepository) ReverseAllocation(ctx context.Context, tx pgx.Tx, allocationID int64, amount string) error {
	query := `UPDATE coupon_allocations SET used_amount = used_amount - $2::NUMERIC, remaining_amount = remaining_amount + $2::NUMERIC WHERE id = $1 AND used_amount >= $2::NUMERIC`
	tag, err := tx.Exec(ctx, query, allocationID, amount)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("allocation not found or insufficient used amount to reverse")
	}
	return nil
}

// ─── Distribution Centers ───

func (r *EntityRepository) ListCenters(ctx context.Context, status string, provinceScope []string, offset, limit int) ([]couponModel.DistributionCenter, int, error) {
	where := "1=1"
	args := []interface{}{}
	argN := 1
	if status != "" {
		where += fmt.Sprintf(" AND status = $%d", argN)
		args = append(args, status)
		argN++
	}
	if len(provinceScope) > 0 {
		where += fmt.Sprintf(" AND province_code = ANY($%d)", argN)
		args = append(args, provinceScope)
		argN++
	}

	var total int
	countArgs := make([]interface{}, len(args))
	copy(countArgs, args)
	if err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM distribution_centers WHERE "+where, countArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := fmt.Sprintf("SELECT id, name, type, address, lat, lng, categories, operating_hours, queue_minutes, stock_status, province_code, status, created_at, updated_at FROM distribution_centers WHERE %s ORDER BY name ASC LIMIT $%d OFFSET $%d", where, argN, argN+1)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var out []couponModel.DistributionCenter
	for rows.Next() {
		var c couponModel.DistributionCenter
		if err := rows.Scan(&c.ID, &c.Name, &c.Type, &c.Address, &c.Lat, &c.Lng, &c.Categories, &c.OperatingHours, &c.QueueMinutes, &c.StockStatus, &c.ProvinceCode, &c.Status, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, c)
	}
	return out, total, nil
}

func (r *EntityRepository) CreateCenter(ctx context.Context, c *couponModel.DistributionCenter) error {
	query := `INSERT INTO distribution_centers (id, name, type, address, lat, lng, categories, operating_hours, queue_minutes, stock_status, province_code, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`
	_, err := r.pool.Exec(ctx, query, c.ID, c.Name, c.Type, c.Address, c.Lat, c.Lng, c.Categories, c.OperatingHours, c.QueueMinutes, c.StockStatus, c.ProvinceCode, c.Status)
	return err
}

func (r *EntityRepository) UpdateCenter(ctx context.Context, id int64, fields map[string]interface{}) error {
	sets := []string{}
	args := []interface{}{id}
	argN := 2
	for k, v := range fields {
		sets = append(sets, fmt.Sprintf("%s = $%d", k, argN))
		args = append(args, v)
		argN++
	}
	if len(sets) == 0 {
		return nil
	}
	query := fmt.Sprintf("UPDATE distribution_centers SET %s WHERE id = $1", strings.Join(sets, ", "))
	_, err := r.pool.Exec(ctx, query, args...)
	return err
}

// ─── Dashboard Stats ───

func (r *EntityRepository) GetDashboardStats(ctx context.Context) (map[string]interface{}, error) {
	stats := map[string]interface{}{}

	// Household counts
	var totalHH, activeHH int
	_ = r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM households").Scan(&totalHH)
	_ = r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM households WHERE status = 'active'").Scan(&activeHH)
	stats["total_households"] = totalHH
	stats["active_households"] = activeHH

	// Today's redemptions
	var todayCount int
	var todayValue string
	_ = r.pool.QueryRow(ctx, "SELECT COUNT(*), COALESCE(SUM(amount::NUMERIC), 0)::TEXT FROM coupon_redemptions WHERE created_at >= CURRENT_DATE").Scan(&todayCount, &todayValue)
	stats["today_redemptions"] = todayCount
	stats["today_redemption_value"] = todayValue

	// Open disputes
	var disputes int
	_ = r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM coupon_redemptions WHERE status = 'disputed'").Scan(&disputes)
	stats["open_disputes"] = disputes

	// Pending KYC
	var pendingKYC int
	_ = r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM household_members WHERE kyc_verified = false").Scan(&pendingKYC)
	stats["pending_kyc"] = pendingKYC

	// Low stock centers
	var lowStock int
	_ = r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM distribution_centers WHERE status = 'low_stock'").Scan(&lowStock)
	stats["low_stock_centers"] = lowStock

	// Active swaps
	var swaps int
	_ = r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM power_bank_swaps WHERE status IN ('pending','ready','picked_up')").Scan(&swaps)
	stats["active_swaps"] = swaps

	// Pending tickets
	var tickets int
	_ = r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM support_tickets WHERE status IN ('open','in_progress')").Scan(&tickets)
	stats["pending_tickets"] = tickets

	// Pending providers
	var providers int
	_ = r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM providers WHERE status = 'pending'").Scan(&providers)
	stats["pending_providers"] = providers

	// Pending offerings
	var offerings int
	_ = r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM product_offerings WHERE status = 'pending'").Scan(&offerings)
	stats["pending_offerings"] = offerings

	return stats, nil
}

// ─── Members ───

func (r *EntityRepository) ListMembers(ctx context.Context, search string, kycVerified *bool, offset, limit int) ([]couponModel.HouseholdMember, int, error) {
	where := "1=1"
	args := []interface{}{}
	argN := 1
	if search != "" {
		where += fmt.Sprintf(" AND (full_name ILIKE $%d OR national_code LIKE $%d)", argN, argN)
		args = append(args, "%"+search+"%")
		argN++
	}
	if kycVerified != nil {
		where += fmt.Sprintf(" AND kyc_verified = $%d", argN)
		args = append(args, *kycVerified)
		argN++
	}
	var total int
	countArgs := make([]interface{}, len(args))
	copy(countArgs, args)
	if err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM household_members WHERE "+where, countArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}
	query := fmt.Sprintf("SELECT id, household_id, national_code, full_name, birth_date, gender, relationship, age_group, special_flags, kyc_verified, created_at FROM household_members WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d", where, argN, argN+1)
	args = append(args, limit, offset)
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []couponModel.HouseholdMember
	for rows.Next() {
		var m couponModel.HouseholdMember
		if err := rows.Scan(&m.ID, &m.HouseholdID, &m.NationalCode, &m.FullName, &m.BirthDate, &m.Gender, &m.Relationship, &m.AgeGroup, &m.SpecialFlags, &m.KYCVerified, &m.CreatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, m)
	}
	return out, total, nil
}

func (r *EntityRepository) VerifyMemberKYC(ctx context.Context, memberID int64, verified bool) error {
	_, err := r.pool.Exec(ctx, "UPDATE household_members SET kyc_verified = $2 WHERE id = $1", memberID, verified)
	return err
}

// ─── Allocations ───

func (r *EntityRepository) ListAllocations(ctx context.Context, status, category string, offset, limit int) ([]couponModel.CouponAllocation, int, error) {
	where := "1=1"
	args := []interface{}{}
	argN := 1
	if status != "" {
		where += fmt.Sprintf(" AND status = $%d", argN)
		args = append(args, status)
		argN++
	}
	if category != "" {
		where += fmt.Sprintf(" AND category = $%d", argN)
		args = append(args, category)
		argN++
	}
	var total int
	countArgs := make([]interface{}, len(args))
	copy(countArgs, args)
	if err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM coupon_allocations WHERE "+where, countArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}
	query := fmt.Sprintf(`SELECT id, household_id, category, cycle_start, cycle_end, total_amount, used_amount, remaining_amount,
		weekly_release_pct_1, weekly_release_pct_2, weekly_release_pct_3, weekly_release_pct_4,
		current_week, status, created_at
		FROM coupon_allocations WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, where, argN, argN+1)
	args = append(args, limit, offset)
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []couponModel.CouponAllocation
	for rows.Next() {
		var a couponModel.CouponAllocation
		var p1, p2, p3, p4 int
		if err := rows.Scan(&a.ID, &a.HouseholdID, &a.Category, &a.CycleStart, &a.CycleEnd, &a.TotalAmount, &a.UsedAmount, &a.RemainingAmount, &p1, &p2, &p3, &p4, &a.CurrentWeek, &a.Status, &a.CreatedAt); err != nil {
			return nil, 0, err
		}
		a.WeeklyReleasePcts = [4]int{p1, p2, p3, p4}
		out = append(out, a)
	}
	return out, total, nil
}

// AdjustAllocation sets the allocation total to a new value and recalculates
// remaining = newTotal - used. Validates that newTotal is non-negative and
// >= used_amount so remaining never goes negative.
//
// Bug B3 fix: previous version performed no validation, allowing negative
// remaining and silently writing non-numeric strings.
func (r *EntityRepository) AdjustAllocation(ctx context.Context, id int64, newAmount string, adminID int64) error {
	// Validate the input is a real numeric string before sending to Postgres.
	// strconv only validates plain floats; allocations are big.Float text.
	if _, err := strconv.ParseFloat(newAmount, 64); err != nil {
		return fmt.Errorf("invalid amount: %w", err)
	}
	parsed, _ := strconv.ParseFloat(newAmount, 64)
	if parsed < 0 {
		return fmt.Errorf("amount cannot be negative")
	}

	// Atomic conditional update: only succeed if newTotal >= used_amount.
	tag, err := r.pool.Exec(ctx, `
		UPDATE coupon_allocations
		SET total_amount     = $2::NUMERIC,
		    remaining_amount = $2::NUMERIC - used_amount,
		    updated_by       = $3,
		    updated_at       = NOW()
		WHERE id = $1 AND used_amount <= $2::NUMERIC`,
		id, newAmount, adminID,
	)
	if err != nil {
		return fmt.Errorf("adjust allocation: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("allocation not found or new total is below already-used amount")
	}
	return nil
}

// PauseAllocation sets is_paused=true with a reason. Paused allocations
// are excluded from new redemptions until resumed.
func (r *EntityRepository) PauseAllocation(ctx context.Context, id int64, reason string, adminID int64) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE coupon_allocations
		SET is_paused = true, pause_reason = $2, updated_by = $3, updated_at = NOW()
		WHERE id = $1`, id, reason, adminID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("allocation not found")
	}
	return nil
}

// ResumeAllocation clears the paused flag.
func (r *EntityRepository) ResumeAllocation(ctx context.Context, id int64, adminID int64) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE coupon_allocations
		SET is_paused = false, pause_reason = NULL, updated_by = $2, updated_at = NOW()
		WHERE id = $1`, id, adminID)
	return err
}

// ExpireAllocation sets the status to expired (cannot be redeemed further).
func (r *EntityRepository) ExpireAllocation(ctx context.Context, id int64, adminID int64) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE coupon_allocations
		SET status = 'expired', updated_by = $2, updated_at = NOW()
		WHERE id = $1 AND status = 'active'`, id, adminID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("allocation not found or not active")
	}
	return nil
}

// ─── Catalog Items ───

func (r *EntityRepository) ListCatalogItems(ctx context.Context, category string, offset, limit int) ([]map[string]interface{}, int, error) {
	where := "ci.is_active = true"
	args := []interface{}{}
	argN := 1
	if category != "" {
		where += fmt.Sprintf(" AND ci.category = $%d", argN)
		args = append(args, category)
		argN++
	}
	var total int
	countArgs := make([]interface{}, len(args))
	copy(countArgs, args)
	if err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM catalog_items ci WHERE "+where, countArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}
	query := fmt.Sprintf(`SELECT ci.id, ci.category, ci.name, ci.name_fa, ci.icon, ci.scope, ci.region, ci.default_amount, cu.code AS unit_code, cu.name AS unit_name
		FROM catalog_items ci JOIN catalog_units cu ON ci.unit_id = cu.id
		WHERE %s ORDER BY ci.category, ci.sort_order LIMIT $%d OFFSET $%d`, where, argN, argN+1)
	args = append(args, limit, offset)
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []map[string]interface{}
	for rows.Next() {
		var id int64
		var cat, name, nameFa, icon, scope, unitCode, unitName string
		var region *string
		var defaultAmt float64
		if err := rows.Scan(&id, &cat, &name, &nameFa, &icon, &scope, &region, &defaultAmt, &unitCode, &unitName); err != nil {
			return nil, 0, err
		}
		row := map[string]interface{}{
			"id": id, "category": cat, "name": name, "name_fa": nameFa, "icon": icon,
			"scope": scope, "default_amount": defaultAmt, "unit_code": unitCode, "unit_name": unitName,
		}
		if region != nil {
			row["region"] = *region
		}
		out = append(out, row)
	}
	return out, total, nil
}

// ─── Power Banks ───

func (r *EntityRepository) ListPowerBanks(ctx context.Context, status string, offset, limit int) ([]couponModel.PowerBankSwap, int, error) {
	where := "1=1"
	args := []interface{}{}
	argN := 1
	if status != "" {
		where += fmt.Sprintf(" AND status = $%d", argN)
		args = append(args, status)
		argN++
	}
	var total int
	countArgs := make([]interface{}, len(args))
	copy(countArgs, args)
	if err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM power_bank_swaps WHERE "+where, countArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}
	query := fmt.Sprintf("SELECT id, household_id, member_id, status, swap_code, center_id, picked_up_at, returned_at, created_at, updated_at FROM power_bank_swaps WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d", where, argN, argN+1)
	args = append(args, limit, offset)
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []couponModel.PowerBankSwap
	for rows.Next() {
		var s couponModel.PowerBankSwap
		if err := rows.Scan(&s.ID, &s.HouseholdID, &s.MemberID, &s.Status, &s.SwapCode, &s.CenterID, &s.PickedUpAt, &s.ReturnedAt, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, s)
	}
	return out, total, nil
}

// ─── Analytics ───

func (r *EntityRepository) GetRedemptionsByDay(ctx context.Context, days int) ([]map[string]interface{}, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT created_at::date AS day, category, COUNT(*) AS count, SUM(amount::NUMERIC) AS total
		 FROM coupon_redemptions
		 WHERE created_at >= NOW() - make_interval(days => $1)
		 GROUP BY day, category ORDER BY day`, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []map[string]interface{}
	for rows.Next() {
		var day, category string
		var count int
		var total float64
		if err := rows.Scan(&day, &category, &count, &total); err != nil {
			return nil, err
		}
		out = append(out, map[string]interface{}{"day": day, "category": category, "count": count, "total": total})
	}
	return out, nil
}

func (r *EntityRepository) GetCategoryDistribution(ctx context.Context) ([]map[string]interface{}, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT category, COUNT(*) AS count, SUM(amount::NUMERIC) AS total
		 FROM coupon_redemptions GROUP BY category ORDER BY total DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []map[string]interface{}
	for rows.Next() {
		var category string
		var count int
		var total float64
		if err := rows.Scan(&category, &count, &total); err != nil {
			return nil, err
		}
		out = append(out, map[string]interface{}{"category": category, "count": count, "total": total})
	}
	return out, nil
}

func (r *EntityRepository) GetCenterUtilization(ctx context.Context) ([]map[string]interface{}, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT dc.name, dc.status, COUNT(cr.id) AS redemptions
		 FROM distribution_centers dc
		 LEFT JOIN coupon_redemptions cr ON cr.distribution_point_id = dc.id AND cr.created_at >= NOW() - '30 days'::INTERVAL
		 GROUP BY dc.id, dc.name, dc.status ORDER BY redemptions DESC LIMIT 20`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []map[string]interface{}
	for rows.Next() {
		var name, status string
		var count int
		if err := rows.Scan(&name, &status, &count); err != nil {
			return nil, err
		}
		out = append(out, map[string]interface{}{"name": name, "status": status, "redemptions": count})
	}
	return out, nil
}

// ─── CSV Export ───

func (r *EntityRepository) ExportHouseholdsCSV(ctx context.Context) ([][]string, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT household_code, status, kyc_tier, location_segment, address, CAST(telegram_user_id AS TEXT), created_at::TEXT
		 FROM households ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	data := [][]string{{"Household Code", "Status", "KYC Tier", "Region", "Address", "Telegram ID", "Created"}}
	for rows.Next() {
		var code, status, region, address, tgID, created string
		var tier int
		if err := rows.Scan(&code, &status, &tier, &region, &address, &tgID, &created); err != nil {
			return nil, err
		}
		data = append(data, []string{code, status, fmt.Sprintf("%d", tier), region, address, tgID, created})
	}
	return data, nil
}

func (r *EntityRepository) ExportRedemptionsCSV(ctx context.Context) ([][]string, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT coupon_code, h.household_code, cr.category, cr.amount, cr.status, cr.created_at::TEXT
		 FROM coupon_redemptions cr JOIN households h ON h.id = cr.household_id
		 ORDER BY cr.created_at DESC LIMIT 10000`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	data := [][]string{{"Coupon Code", "Household", "Category", "Amount", "Status", "Created"}}
	for rows.Next() {
		var code, hhCode, cat, amount, status, created string
		if err := rows.Scan(&code, &hhCode, &cat, &amount, &status, &created); err != nil {
			return nil, err
		}
		data = append(data, []string{code, hhCode, cat, amount, status, created})
	}
	return data, nil
}

// ─── System Settings ───

func (r *EntityRepository) ListSettings(ctx context.Context) ([]map[string]interface{}, error) {
	rows, err := r.pool.Query(ctx, "SELECT key, value, updated_at FROM system_settings ORDER BY key")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []map[string]interface{}
	for rows.Next() {
		var key string
		var value []byte
		var updatedAt interface{}
		if err := rows.Scan(&key, &value, &updatedAt); err != nil {
			return nil, err
		}
		out = append(out, map[string]interface{}{"key": key, "value": string(value), "updated_at": updatedAt})
	}
	return out, nil
}

func (r *EntityRepository) UpdateSetting(ctx context.Context, key, value string, adminID int64) error {
	_, err := r.pool.Exec(ctx,
		"INSERT INTO system_settings (key, value, updated_by, updated_at) VALUES ($1, $2::JSONB, $3, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2::JSONB, updated_by = $3, updated_at = NOW()",
		key, value, adminID)
	return err
}

// ─── Notices (Postgres source of truth) ───

// Notice mirrors the public notice schema. The admin panel manages these via
// CRUD endpoints; the Mini App reads them from a Redis cache rebuilt on every
// write.
type Notice struct {
	ID        string    `json:"id"`
	Text      string    `json:"text"`
	TextFa    string    `json:"text_fa"`
	Type      string    `json:"type"`
	Link      *string   `json:"link,omitempty"`
	Active    bool      `json:"active"`
	SortOrder int       `json:"sort_order"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ListNoticesAll returns every notice (active and inactive) for the admin UI.
func (r *EntityRepository) ListNoticesAll(ctx context.Context) ([]Notice, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, text, text_fa, type, link, active, sort_order, created_at, updated_at
		FROM notices ORDER BY sort_order ASC, created_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Notice
	for rows.Next() {
		var n Notice
		if err := rows.Scan(&n.ID, &n.Text, &n.TextFa, &n.Type, &n.Link, &n.Active, &n.SortOrder, &n.CreatedAt, &n.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, nil
}

// ListNoticesActive returns only active notices for the public-facing cache.
// This is the read called by rebuildNoticesCache in the settings handler.
func (r *EntityRepository) ListNoticesActive(ctx context.Context) ([]Notice, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, text, text_fa, type, link, active, sort_order, created_at, updated_at
		FROM notices WHERE active = true ORDER BY sort_order ASC, created_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Notice
	for rows.Next() {
		var n Notice
		if err := rows.Scan(&n.ID, &n.Text, &n.TextFa, &n.Type, &n.Link, &n.Active, &n.SortOrder, &n.CreatedAt, &n.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, nil
}

// CreateNotice inserts a new notice and populates created_at/updated_at on
// the supplied struct so the API response is complete.
func (r *EntityRepository) CreateNotice(ctx context.Context, n *Notice, adminID int64) error {
	if n.SortOrder == 0 {
		var maxOrder int
		_ = r.pool.QueryRow(ctx, "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM notices").Scan(&maxOrder)
		n.SortOrder = maxOrder
	}
	return r.pool.QueryRow(ctx, `
		INSERT INTO notices (id, text, text_fa, type, link, active, sort_order, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING created_at, updated_at`,
		n.ID, n.Text, n.TextFa, n.Type, n.Link, n.Active, n.SortOrder, adminID,
	).Scan(&n.CreatedAt, &n.UpdatedAt)
}

// UpdateNotice updates the mutable fields of a notice. Fields with zero
// values still overwrite (full PUT semantics, not PATCH).
func (r *EntityRepository) UpdateNotice(ctx context.Context, n *Notice) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE notices SET text = $2, text_fa = $3, type = $4, link = $5, active = $6
		WHERE id = $1`,
		n.ID, n.Text, n.TextFa, n.Type, n.Link, n.Active,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("notice not found")
	}
	return nil
}

// DeleteNotice removes a notice by id.
func (r *EntityRepository) DeleteNotice(ctx context.Context, id string) error {
	tag, err := r.pool.Exec(ctx, "DELETE FROM notices WHERE id = $1", id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("notice not found")
	}
	return nil
}

// ReorderNotices updates sort_order for the given list of ids in order.
// Atomic via a single transaction so concurrent admins can't interleave
// partial reorders.
func (r *EntityRepository) ReorderNotices(ctx context.Context, ids []string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	for i, id := range ids {
		if _, err := tx.Exec(ctx, "UPDATE notices SET sort_order = $2 WHERE id = $1", id, i); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// ReplaceNotices is a transactional bulk replace used by the legacy
// "save all" endpoint. Truncates and re-inserts in a single tx.
func (r *EntityRepository) ReplaceNotices(ctx context.Context, notices []Notice, adminID int64) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, "DELETE FROM notices"); err != nil {
		return err
	}
	for _, n := range notices {
		if _, err := tx.Exec(ctx, `
			INSERT INTO notices (id, text, text_fa, type, link, active, sort_order, created_by)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			n.ID, n.Text, n.TextFa, n.Type, n.Link, n.Active, n.SortOrder, adminID,
		); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// ─── Fraud Detection ───

func (r *EntityRepository) GetFraudIndicators(ctx context.Context) ([]map[string]interface{}, error) {
	var alerts []map[string]interface{}

	// Households with >5 redemptions in last hour
	var rapidCount int
	_ = r.pool.QueryRow(ctx,
		`SELECT COUNT(DISTINCT household_id) FROM coupon_redemptions
		 WHERE created_at >= NOW() - '1 hour'::INTERVAL
		 GROUP BY household_id HAVING COUNT(*) > 5`).Scan(&rapidCount)
	if rapidCount > 0 {
		alerts = append(alerts, map[string]interface{}{
			"type": "rapid_redemption", "severity": "warning",
			"message": fmt.Sprintf("%d households with >5 redemptions in the last hour", rapidCount),
		})
	}

	// Dispute spike: >10 disputes in last hour
	var disputeSpike int
	_ = r.pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM coupon_redemptions WHERE status = 'disputed' AND created_at >= NOW() - '1 hour'::INTERVAL").Scan(&disputeSpike)
	if disputeSpike > 10 {
		alerts = append(alerts, map[string]interface{}{
			"type": "dispute_spike", "severity": "critical",
			"message": fmt.Sprintf("%d disputes in the last hour", disputeSpike),
		})
	}

	// Centers with zero redemptions in 24h
	var offlineCenters int
	_ = r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM distribution_centers dc
		 WHERE dc.status = 'open' AND NOT EXISTS (
			 SELECT 1 FROM coupon_redemptions cr WHERE cr.distribution_point_id = dc.id AND cr.created_at >= NOW() - '24 hours'::INTERVAL
		 )`).Scan(&offlineCenters)
	if offlineCenters > 0 {
		alerts = append(alerts, map[string]interface{}{
			"type": "center_offline", "severity": "info",
			"message": fmt.Sprintf("%d open centers with no redemptions in 24h", offlineCenters),
		})
	}

	return alerts, nil
}

// ─── Support Tickets ───

func (r *EntityRepository) ListTickets(ctx context.Context, status, priority string, offset, limit int) ([]couponModel.SupportTicket, int, error) {
	where := "1=1"
	args := []interface{}{}
	argN := 1
	if status != "" {
		where += fmt.Sprintf(" AND status = $%d", argN)
		args = append(args, status)
		argN++
	}
	if priority != "" {
		where += fmt.Sprintf(" AND priority = $%d", argN)
		args = append(args, priority)
		argN++
	}

	var total int
	countArgs := make([]interface{}, len(args))
	copy(countArgs, args)
	if err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM support_tickets WHERE "+where, countArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := fmt.Sprintf("SELECT id, household_id, telegram_user_id, category, priority, subject, description, reference_code, status, assigned_to, created_at, updated_at FROM support_tickets WHERE %s ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END, created_at DESC LIMIT $%d OFFSET $%d", where, argN, argN+1)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var out []couponModel.SupportTicket
	for rows.Next() {
		var t couponModel.SupportTicket
		if err := rows.Scan(&t.ID, &t.HouseholdID, &t.TelegramUserID, &t.Category, &t.Priority, &t.Subject, &t.Description, &t.ReferenceCode, &t.Status, &t.AssignedTo, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, t)
	}
	return out, total, nil
}

func (r *EntityRepository) UpdateTicketStatus(ctx context.Context, id int64, status string, adminID int64) error {
	query := "UPDATE support_tickets SET status = $2, assigned_to = $3 WHERE id = $1"
	if status == "resolved" {
		query = "UPDATE support_tickets SET status = $2, assigned_to = $3, resolved_at = NOW() WHERE id = $1"
	}
	_, err := r.pool.Exec(ctx, query, id, status, adminID)
	return err
}

// ─── Providers ───

func (r *EntityRepository) ListProviders(ctx context.Context, status string, offset, limit int) ([]interface{}, int, error) {
	where := "1=1"
	args := []interface{}{}
	argN := 1
	if status != "" {
		where += fmt.Sprintf(" AND p.status = $%d", argN)
		args = append(args, status)
		argN++
	}

	var total int
	countArgs := make([]interface{}, len(args))
	copy(countArgs, args)
	if err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM providers p WHERE "+where, countArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := fmt.Sprintf(`SELECT p.id, p.name, p.name_fa, s.role AS type, s.code AS service_type, p.status, p.store_address, p.created_at
		FROM providers p JOIN provider_service_types s ON p.service_type_id = s.id
		WHERE %s ORDER BY p.created_at DESC LIMIT $%d OFFSET $%d`, where, argN, argN+1)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var out []interface{}
	for rows.Next() {
		var id int64
		var name, nameFa, ptype, serviceType, pstatus, storeAddr string
		var createdAt interface{}
		if err := rows.Scan(&id, &name, &nameFa, &ptype, &serviceType, &pstatus, &storeAddr, &createdAt); err != nil {
			return nil, 0, err
		}
		out = append(out, map[string]interface{}{
			"id": id, "name": name, "name_fa": nameFa, "type": ptype,
			"service_type": serviceType, "status": pstatus,
			"store_address": storeAddr, "created_at": createdAt,
		})
	}
	return out, total, nil
}

// ─── Volunteers ───

func (r *EntityRepository) ListVolunteers(ctx context.Context, status string, offset, limit int) ([]map[string]interface{}, int, error) {
	where := "1=1"
	args := []interface{}{}
	argN := 1
	if status != "" {
		where += fmt.Sprintf(" AND status = $%d", argN)
		args = append(args, status)
		argN++
	}

	var total int
	countArgs := make([]interface{}, len(args))
	copy(countArgs, args)
	if err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM volunteers WHERE "+where, countArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := fmt.Sprintf("SELECT id, full_name, specialty, status, created_at FROM volunteers WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d", where, argN, argN+1)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var out []map[string]interface{}
	for rows.Next() {
		var id int64
		var fullName, status string
		var specialty *string
		var createdAt interface{}
		if err := rows.Scan(&id, &fullName, &specialty, &status, &createdAt); err != nil {
			return nil, 0, err
		}
		row := map[string]interface{}{
			"id": id, "full_name": fullName, "status": status, "created_at": createdAt,
		}
		if specialty != nil {
			row["specialty"] = *specialty
		}
		out = append(out, row)
	}
	return out, total, nil
}

func (r *EntityRepository) UpdateVolunteerStatus(ctx context.Context, id int64, status string, adminID int64) error {
	query := "UPDATE volunteers SET status = $2, verified_by = $3"
	if status == "approved" {
		query += ", verified_at = NOW()"
	}
	query += " WHERE id = $1"
	_, err := r.pool.Exec(ctx, query, id, status, adminID)
	return err
}

func (r *EntityRepository) UpdateProviderStatus(ctx context.Context, id int64, status string, adminID int64) error {
	query := "UPDATE providers SET status = $2"
	if status == "approved" {
		query += ", approved_at = NOW(), approved_by = $3"
	} else {
		query += ", approved_by = $3"
	}
	query += " WHERE id = $1"
	tag, err := r.pool.Exec(ctx, query, id, status, adminID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("provider not found")
	}
	return nil
}

// ─── Members: bulk verify, soft delete, update fields ───

// BulkVerifyMembers marks multiple members KYC-verified in one statement.
// Returns the number of rows affected.
func (r *EntityRepository) BulkVerifyMembers(ctx context.Context, ids []int64) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	tag, err := r.pool.Exec(ctx, "UPDATE household_members SET kyc_verified = true WHERE id = ANY($1)", ids)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// SoftDeleteMember sets a member as inactive. Since household_members has no
// `deleted_at` column today, we encode soft-delete as relationship='deleted'
// + kyc_verified=false. The household will need re-allocation after this.
//
// Trade-off: a hard delete would break audit trails and FKs to redemptions.
// The soft-delete pattern preserves history.
func (r *EntityRepository) SoftDeleteMember(ctx context.Context, memberID int64) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE household_members
		SET relationship = 'deleted', kyc_verified = false
		WHERE id = $1`, memberID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("member not found")
	}
	return nil
}

// ─── Households: admin notes, kyc_status, full update ───

// UpdateHouseholdNotes appends/replaces admin_notes for a household.
func (r *EntityRepository) UpdateHouseholdNotes(ctx context.Context, id int64, notes string, adminID int64) error {
	tag, err := r.pool.Exec(ctx,
		"UPDATE households SET admin_notes = $2, updated_by = $3 WHERE id = $1",
		id, notes, adminID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("household not found")
	}
	return nil
}

// UpdateHouseholdKYCStatus sets kyc_status. Valid values: pending, verified,
// rejected, expired. Used by KYC officer to force re-verification.
func (r *EntityRepository) UpdateHouseholdKYCStatus(ctx context.Context, id int64, status string, adminID int64) error {
	if status != "pending" && status != "verified" && status != "rejected" && status != "expired" {
		return fmt.Errorf("invalid kyc_status")
	}
	tag, err := r.pool.Exec(ctx,
		"UPDATE households SET kyc_status = $2, updated_by = $3 WHERE id = $1",
		id, status, adminID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("household not found")
	}
	return nil
}

// ─── Distribution Centers: stock + status management ───

// UpdateCenterStock updates the per-category stock_status JSONB blob and
// re-derives the overall status based on whether any category is empty.
func (r *EntityRepository) UpdateCenterStock(ctx context.Context, id int64, stockStatus map[string]string, adminID int64) error {
	// Derive overall status: out_of_stock if any category empty, low_stock if
	// any low, otherwise open. This keeps the dashboard accurate without
	// needing a separate update call.
	derived := "open"
	hasOut, hasLow := false, false
	for _, v := range stockStatus {
		switch v {
		case "out", "out_of_stock":
			hasOut = true
		case "low", "low_stock":
			hasLow = true
		}
	}
	if hasOut {
		derived = "out_of_stock"
	} else if hasLow {
		derived = "low_stock"
	}
	tag, err := r.pool.Exec(ctx, `
		UPDATE distribution_centers
		SET stock_status = $2::jsonb, status = $3, last_modified_by = $4, updated_at = NOW()
		WHERE id = $1`,
		id, mapToJSONString(stockStatus), derived, adminID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("center not found")
	}
	return nil
}

// DeactivateCenter sets status=closed and stamps deactivated_at.
func (r *EntityRepository) DeactivateCenter(ctx context.Context, id int64, adminID int64) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE distribution_centers
		SET status = 'closed', deactivated_at = NOW(), last_modified_by = $2
		WHERE id = $1`, id, adminID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("center not found")
	}
	return nil
}

// GetCenter fetches a single center for editing.
func (r *EntityRepository) GetCenter(ctx context.Context, id int64) (*couponModel.DistributionCenter, error) {
	var c couponModel.DistributionCenter
	err := r.pool.QueryRow(ctx, `
		SELECT id, name, type, address, lat, lng, categories, operating_hours, queue_minutes,
		       stock_status, province_code, status, created_at, updated_at
		FROM distribution_centers WHERE id = $1`, id).
		Scan(&c.ID, &c.Name, &c.Type, &c.Address, &c.Lat, &c.Lng, &c.Categories, &c.OperatingHours,
			&c.QueueMinutes, &c.StockStatus, &c.ProvinceCode, &c.Status, &c.CreatedAt, &c.UpdatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// ─── Power Banks: admin force status ───

// AdminForceSwapStatus sets a swap to any status, bypassing the normal
// state machine. Used by admins to recover stuck swaps.
func (r *EntityRepository) AdminForceSwapStatus(ctx context.Context, id int64, status, notes string, adminID int64) error {
	valid := map[string]bool{
		"pending": true, "ready": true, "picked_up": true,
		"returned": true, "cancelled": true, "expired": true,
	}
	if !valid[status] {
		return fmt.Errorf("invalid status")
	}
	tag, err := r.pool.Exec(ctx, `
		UPDATE power_bank_swaps
		SET status = $2, admin_notes = $3, forced_by = $4, updated_at = NOW()
		WHERE id = $1`, id, status, notes, adminID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("swap not found")
	}
	return nil
}

// ─── Catalog Items: create ───

// CreateCatalogItem inserts a new admin-defined catalog item.
// Bug B1 fix: previously POST /catalog/items was wired to the LIST handler,
// silently broken. This is the real create.
//
// Note on scope/region: the catalog_items table has CHECK constraints
// requiring scope ∈ {national, regional} and region ∈ {tehran, urban, rural}.
// We accept the wider {global, national} from the frontend and normalize.
func (r *EntityRepository) CreateCatalogItem(ctx context.Context, item map[string]interface{}, adminID int64) (int64, error) {
	idStr, ok := item["id"].(string)
	if !ok || idStr == "" {
		return 0, fmt.Errorf("id required")
	}
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid id: %w", err)
	}
	category, _ := item["category"].(string)
	name, _ := item["name"].(string)
	nameFa, _ := item["name_fa"].(string)
	icon, _ := item["icon"].(string)
	scope, _ := item["scope"].(string)
	if scope == "" || scope == "global" {
		scope = "national"
	}
	if scope != "national" && scope != "regional" {
		return 0, fmt.Errorf("scope must be national or regional")
	}
	region, _ := item["region"].(string)
	defaultAmtRaw, _ := item["default_amount"].(float64)
	unitCode, _ := item["unit_code"].(string)

	if category == "" || name == "" || nameFa == "" || unitCode == "" {
		return 0, fmt.Errorf("category, name, name_fa, unit_code required")
	}

	// Look up unit_id from unit_code.
	var unitID int64
	if err := r.pool.QueryRow(ctx, "SELECT id FROM catalog_units WHERE code = $1", unitCode).Scan(&unitID); err != nil {
		return 0, fmt.Errorf("unit_code not found: %w", err)
	}

	var regionPtr *string
	if scope == "regional" {
		if region == "" {
			return 0, fmt.Errorf("region required for regional scope")
		}
		regionPtr = &region
	}

	// Note: catalog_items table doesn't have created_by — admin attribution
	// lives in the audit_logs table instead. adminID is passed to the
	// service layer which records it in the audit log.
	_ = adminID

	_, err = r.pool.Exec(ctx, `
		INSERT INTO catalog_items (id, category, name, name_fa, icon, scope, region, default_amount, unit_id, sort_order, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, true)`,
		id, category, name, nameFa, icon, scope, regionPtr, defaultAmtRaw, unitID,
	)
	if err != nil {
		return 0, fmt.Errorf("create catalog item: %w", err)
	}
	return id, nil
}

// mapToJSONString serializes a string map to a compact JSON string for jsonb columns.
func mapToJSONString(m map[string]string) string {
	if len(m) == 0 {
		return "{}"
	}
	parts := make([]string, 0, len(m))
	for k, v := range m {
		// Crude but safe: keys are category constants, values are status enums.
		parts = append(parts, fmt.Sprintf("%q:%q", k, v))
	}
	return "{" + strings.Join(parts, ",") + "}"
}
