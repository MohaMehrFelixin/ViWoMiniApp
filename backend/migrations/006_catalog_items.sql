-- 006_catalog_items.sql
-- Admin-defined catalog of distributable items with per-item units.
--
-- Design:
--   - catalog_units:  admin creates measurement units (kg, g, L, cans, pcs, ...)
--   - catalog_items:  admin creates products per category, each with its own unit
--                     items can be "national" (same everywhere) or "regional"
--   - household_item_allocations:  per-household, per-item, per-cycle quotas
--                                   tracks allocated vs used at item level
--
-- This replaces the hardcoded FoodBasket arrays in the frontend.
-- Category-level coupon_allocations remain as the budget ceiling;
-- item allocations are the granular breakdown within a category.

-- ============================================================
-- MEASUREMENT UNITS  (admin-defined)
-- ============================================================
CREATE TABLE IF NOT EXISTS catalog_units (
    id         BIGINT PRIMARY KEY,
    code       VARCHAR(20) NOT NULL,         -- machine key: "kg", "g", "L", "pcs", "cans"
    name       VARCHAR(50) NOT NULL,         -- "Kilograms"
    name_fa    VARCHAR(50) NOT NULL,         -- "کیلوگرم"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cunits_code ON catalog_units (code);

-- Seed common units
INSERT INTO catalog_units (id, code, name, name_fa) VALUES
    (1,  'kg',       'kg',       'کیلو'),
    (2,  'g',        'g',        'گرم'),
    (3,  'L',        'L',        'لیتر'),
    (4,  'mL',       'mL',       'میلی‌لیتر'),
    (5,  'pcs',      'pcs',      'عدد'),
    (6,  'cans',     'cans',     'قوطی'),
    (7,  'loaves',   'loaves',   'قرص نان'),
    (8,  'bottles',  'bottles',  'بطری'),
    (9,  'packets',  'packets',  'بسته'),
    (10, 'kits',     'kits',     'بسته'),
    (11, 'cylinders','cylinders','کپسول'),
    (12, 'items',    'items',    'عدد')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- CATALOG ITEMS  (admin-defined products / services)
-- ============================================================
-- Each row is a distributable item within a coupon category.
-- Admin sets name, unit, default allocation, scope, and region.
CREATE TABLE IF NOT EXISTS catalog_items (
    id              BIGINT PRIMARY KEY,
    category        VARCHAR(20) NOT NULL,
    unit_id         BIGINT NOT NULL REFERENCES catalog_units(id),

    name            VARCHAR(200) NOT NULL,
    name_fa         VARCHAR(200) NOT NULL,
    icon            VARCHAR(10) NOT NULL DEFAULT '',  -- emoji, e.g. 🍚

    -- national = same allocation for all regions
    -- regional = only allocated to households in the matching region
    scope           VARCHAR(20) NOT NULL DEFAULT 'national',
    region          VARCHAR(20),  -- NULL for national; 'tehran'/'urban'/'rural' for regional

    -- Base allocation amount per household per cycle (admin sets this).
    -- Actual allocation may differ per household (special flags, family size, etc.)
    default_amount  NUMERIC(20,2) NOT NULL DEFAULT 0,

    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_ci_cat CHECK (category IN ('water','food','fuel','hygiene','medical','energy')),
    CONSTRAINT chk_ci_scope CHECK (scope IN ('national','regional')),
    CONSTRAINT chk_ci_region CHECK (
        (scope = 'national' AND region IS NULL) OR
        (scope = 'regional' AND region IN ('tehran','urban','rural'))
    ),
    CONSTRAINT chk_ci_amount CHECK (default_amount >= 0)
);
CREATE INDEX IF NOT EXISTS idx_ci_cat ON catalog_items (category, is_active);
CREATE INDEX IF NOT EXISTS idx_ci_cat_scope ON catalog_items (category, scope, region);
CREATE TRIGGER trg_ci_upd BEFORE UPDATE ON catalog_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SEED: National food items (same for all regions)
-- ============================================================
INSERT INTO catalog_items (id, category, unit_id, name, name_fa, icon, scope, region, default_amount, sort_order) VALUES
    -- Essential food items (nationwide)
    (101, 'food', 1,  'Rice',          'برنج',      '🍚', 'national', NULL,  5,     1),
    (102, 'food', 3,  'Cooking Oil',   'روغن',      '🫗', 'national', NULL,  2,     2),
    (103, 'food', 1,  'Sugar',         'شکر',       '🧂', 'national', NULL,  1.5,   3),
    (104, 'food', 1,  'Salt',          'نمک',       '🧂', 'national', NULL,  0.5,   4),
    (105, 'food', 1,  'Dried Beans',   'حبوبات',    '🫘', 'national', NULL,  2,     5),
    (106, 'food', 1,  'Flour',         'آرد',       '🌾', 'national', NULL,  3,     6),
    (107, 'food', 2,  'Tea',           'چای',       '🍵', 'national', NULL,  200,   7),
    (108, 'food', 6,  'Canned Tuna',   'تن ماهی',   '🐟', 'national', NULL,  2,     8),
    (109, 'food', 2,  'Tomato Paste',  'رب گوجه',   '🍅', 'national', NULL,  800,   9),
    (110, 'food', 2,  'Powdered Milk', 'شیرخشک',    '🥛', 'national', NULL,  400,   10),

    -- Tehran regional items
    (201, 'food', 7,  'Bread (Sangak)','نان سنگک',   '🍞', 'regional', 'tehran', 5,    1),
    (202, 'food', 5,  'Eggs',          'تخم‌مرغ',     '🥚', 'regional', 'tehran', 15,   2),
    (203, 'food', 1,  'Chicken',       'مرغ',         '🍗', 'regional', 'tehran', 1,    3),
    (204, 'food', 1,  'Pasta',         'ماکارونی',    '🍝', 'regional', 'tehran', 1,    4),
    (205, 'food', 2,  'Dates',         'خرما',        '🌴', 'regional', 'tehran', 500,  5),

    -- Urban regional items
    (211, 'food', 5,  'Bread (Lavash)','نان لواش',    '🍞', 'regional', 'urban',  8,    1),
    (212, 'food', 5,  'Eggs',          'تخم‌مرغ',     '🥚', 'regional', 'urban',  12,   2),
    (213, 'food', 2,  'Cheese',        'پنیر',        '🧀', 'regional', 'urban',  400,  3),
    (214, 'food', 2,  'Halva',         'حلوا',        '🍯', 'regional', 'urban',  300,  4),

    -- Rural regional items
    (221, 'food', 5,  'Bread (Taftoon)','نان تافتون',  '🍞', 'regional', 'rural',  10,   1),
    (222, 'food', 5,  'Eggs',          'تخم‌مرغ',      '🥚', 'regional', 'rural',  20,   2),
    (223, 'food', 2,  'Dried Whey',    'کشک',          '🥣', 'regional', 'rural',  500,  3),
    (224, 'food', 2,  'Ghee',          'روغن حیوانی',  '🧈', 'regional', 'rural',  500,  4),
    (225, 'food', 2,  'Dried Fruits',  'خشکبار',       '🥜', 'regional', 'rural',  300,  5),
    (226, 'food', 2,  'Honey',         'عسل',          '🍯', 'regional', 'rural',  250,  6),

    -- Hygiene items (example — admin adds more)
    (301, 'hygiene', 5,  'Soap',          'صابون',       '🧼', 'national', NULL,  4,   1),
    (302, 'hygiene', 8,  'Shampoo',       'شامپو',       '🧴', 'national', NULL,  1,   2),
    (303, 'hygiene', 9,  'Toothpaste',    'خمیردندان',    '🪥', 'national', NULL,  1,   3),
    (304, 'hygiene', 9,  'Sanitary Pads', 'نوار بهداشتی', '🩹', 'national', NULL,  2,   4),
    (305, 'hygiene', 8,  'Bleach',        'مایع سفیدکننده','🧪', 'national', NULL, 1,   5),

    -- Medical items
    (401, 'medical', 10, 'First Aid Kit', 'کیت کمک‌های اولیه', '🩺', 'national', NULL, 1, 1),
    (402, 'medical', 9,  'Pain Relief',   'مسکن',              '💊', 'national', NULL, 1, 2),
    (403, 'medical', 9,  'Bandages',      'باند و گاز',         '🩹', 'national', NULL, 2, 3)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- HOUSEHOLD ITEM ALLOCATIONS  (per-household, per-item, per-cycle)
-- ============================================================
-- Created when admin allocates a new cycle.
-- Tracks how much of each specific item this household can receive
-- and how much they have already received.
CREATE TABLE IF NOT EXISTS household_item_allocations (
    id               BIGINT PRIMARY KEY,
    household_id     BIGINT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    catalog_item_id  BIGINT NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
    cycle_start      TIMESTAMPTZ NOT NULL,
    cycle_end        TIMESTAMPTZ NOT NULL,
    allocated_amount NUMERIC(20,2) NOT NULL DEFAULT 0,
    used_amount      NUMERIC(20,2) NOT NULL DEFAULT 0,
    status           VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_hia_amounts CHECK (allocated_amount >= 0 AND used_amount >= 0),
    CONSTRAINT chk_hia_status CHECK (status IN ('active','expired','exhausted')),
    CONSTRAINT chk_hia_cycle CHECK (cycle_end > cycle_start)
);
CREATE INDEX IF NOT EXISTS idx_hia_hh ON household_item_allocations (household_id, status);
CREATE INDEX IF NOT EXISTS idx_hia_hh_item ON household_item_allocations (household_id, catalog_item_id);
-- Prevent duplicate allocations for same item in same cycle
CREATE UNIQUE INDEX IF NOT EXISTS idx_hia_unique
    ON household_item_allocations (household_id, catalog_item_id, cycle_start);
