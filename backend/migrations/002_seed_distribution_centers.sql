-- Seed distribution centers for Tehran (dev/testing)
-- These cover central Tehran so geolocation lookups within 10km radius will find them.

INSERT INTO distribution_centers (id, name, type, address, lat, lng, categories, operating_hours, queue_minutes, stock_status, province_code, status)
VALUES
(1001, 'مرکز توزیع ولیعصر', 'government', 'تهران، خیابان ولیعصر، نبش خیابان مطهری', 35.7219, 51.3987, '{water,food,fuel,hygiene,medical,energy}', '08:00-20:00', 15, '{"water":"available","food":"available","fuel":"available","hygiene":"available","medical":"available","energy":"available"}', 'THR', 'open'),
(1002, 'مرکز توزیع انقلاب', 'government', 'تهران، خیابان انقلاب، نبش خیابان فلسطین', 35.7005, 51.3890, '{water,food,hygiene,medical}', '07:00-19:00', 25, '{"water":"available","food":"available","hygiene":"low","medical":"available"}', 'THR', 'open'),
(1003, 'مرکز سیار آزادی', 'mobile', 'تهران، میدان آزادی، پارکینگ شرقی', 35.6998, 51.3378, '{water,food,energy}', '09:00-17:00', 5, '{"water":"available","food":"available","energy":"available"}', 'THR', 'open'),
(1004, 'مرکز توزیع تجریش', 'private', 'تهران، میدان تجریش، بازار تجریش', 35.8024, 51.4267, '{water,food,fuel,hygiene,medical,energy}', '08:00-22:00', 10, '{"water":"available","food":"available","fuel":"low","hygiene":"available","medical":"available","energy":"available"}', 'THR', 'open'),
(1005, 'مرکز توزیع شهرری', 'government', 'تهران، شهرری، میدان شهرداری', 35.5853, 51.4321, '{water,food,fuel,hygiene}', '08:00-18:00', 30, '{"water":"available","food":"low","fuel":"available","hygiene":"available"}', 'THR', 'open'),
(1006, 'مرکز سیار پارک ملت', 'mobile', 'تهران، پارک ملت، ورودی شمالی', 35.7610, 51.4310, '{water,food,medical}', '10:00-16:00', 0, '{"water":"available","food":"available","medical":"available"}', 'THR', 'open'),
(1007, 'مرکز توزیع صادقیه', 'government', 'تهران، میدان صادقیه، بلوار آیت‌الله کاشانی', 35.7200, 51.3100, '{water,food,fuel,hygiene,medical,energy}', '07:30-19:30', 20, '{"water":"available","food":"available","fuel":"available","hygiene":"available","medical":"low","energy":"available"}', 'THR', 'open'),
(1008, 'مرکز توزیع پونک', 'private', 'تهران، بلوار پونک، نبش خیابان سردار جنگل', 35.7586, 51.3385, '{food,hygiene,medical,energy}', '09:00-21:00', 8, '{"food":"available","hygiene":"available","medical":"available","energy":"available"}', 'THR', 'open')
ON CONFLICT (id) DO NOTHING;
