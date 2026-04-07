package repository

import (
	"context"
	"fmt"
	"strings"

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

func (r *EntityRepository) ListHouseholds(ctx context.Context, search string, status string, offset, limit int) ([]couponModel.Household, int, error) {
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

func (r *EntityRepository) ListCenters(ctx context.Context, status string, offset, limit int) ([]couponModel.DistributionCenter, int, error) {
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

func (r *EntityRepository) AdjustAllocation(ctx context.Context, id int64, newAmount string, adminID int64) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE coupon_allocations SET total_amount = $2::NUMERIC, remaining_amount = $2::NUMERIC - used_amount, updated_by = $3 WHERE id = $1`,
		id, newAmount, adminID)
	return err
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
		 WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
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

// ─── Notices (Redis-backed) ───

func (r *EntityRepository) GetNoticesFromRedis(ctx context.Context, rdb interface{ Get(ctx context.Context, key string) interface{ Result() (string, error) } }) (string, error) {
	val, err := rdb.Get(ctx, "app:notices").Result()
	if err != nil {
		return "[]", nil
	}
	return val, nil
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
	_, err := r.pool.Exec(ctx, query, id, status, adminID)
	return err
}
