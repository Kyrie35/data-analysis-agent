-- 导入后可用来自测的示例问法（人工对照用）
-- 不是程序文件，仅参考。

-- 1) 华东有多少客户？
-- SELECT COUNT(*) AS customer_count
-- FROM customers c
-- JOIN regions r ON c.region_id = r.id
-- WHERE r.name = '华东';

-- 2) 2025 年一季度各地区销售额（已完成/已发货/已支付，排除取消）
-- SELECT r.name AS region,
--        ROUND(SUM(oi.quantity * oi.unit_price), 2) AS sales_amount
-- FROM orders o
-- JOIN customers c ON o.customer_id = c.id
-- JOIN regions r ON c.region_id = r.id
-- JOIN order_items oi ON oi.order_id = o.id
-- WHERE o.order_date BETWEEN '2025-01-01' AND '2025-03-31'
--   AND o.status IN ('paid', 'shipped', 'completed')
-- GROUP BY r.name
-- ORDER BY sales_amount DESC;

-- 3) 销售额最高的前 5 个产品
-- SELECT p.name,
--        ROUND(SUM(oi.quantity * oi.unit_price), 2) AS sales_amount
-- FROM order_items oi
-- JOIN products p ON oi.product_id = p.id
-- JOIN orders o ON oi.order_id = o.id
-- WHERE o.status <> 'cancelled'
-- GROUP BY p.id, p.name
-- ORDER BY sales_amount DESC
-- LIMIT 5;

-- 4) 单价超过 1000 的在售商品
-- SELECT name, category, unit_price
-- FROM products
-- WHERE is_active = 1 AND unit_price > 1000
-- ORDER BY unit_price DESC;

-- 5) 各客户等级的客户数量
-- SELECT level, COUNT(*) AS cnt
-- FROM customers
-- GROUP BY level
-- ORDER BY level;
