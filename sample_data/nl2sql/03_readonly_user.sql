-- NL2SQL 演示库：只读账号（可选）
-- 用法：mysql -u root -p < 03_readonly_user.sql
-- 说明：把下面密码改成你自己的；应用侧只用这个账号连库。

CREATE USER IF NOT EXISTS 'nl2sql_ro'@'%' IDENTIFIED BY 'nl2sql_ro_pass';
CREATE USER IF NOT EXISTS 'nl2sql_ro'@'localhost' IDENTIFIED BY 'nl2sql_ro_pass';

GRANT SELECT ON nl2sql_demo.* TO 'nl2sql_ro'@'%';
GRANT SELECT ON nl2sql_demo.* TO 'nl2sql_ro'@'localhost';

FLUSH PRIVILEGES;

-- 验证（应成功）：
-- mysql -u nl2sql_ro -pnl2sql_ro_pass -e "SELECT COUNT(*) FROM nl2sql_demo.orders;"
-- 验证（应失败）：
-- mysql -u nl2sql_ro -pnl2sql_ro_pass -e "DELETE FROM nl2sql_demo.orders WHERE id=1;"
