-- NL2SQL 演示库：结构
-- 用法：mysql -u root -p < 01_schema.sql

CREATE DATABASE IF NOT EXISTS nl2sql_demo
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE nl2sql_demo;

SET NAMES utf8mb4;

DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS regions;

CREATE TABLE regions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(16) NOT NULL UNIQUE COMMENT '区域编码',
  name VARCHAR(32) NOT NULL COMMENT '区域名称，如华东',
  manager VARCHAR(32) NULL COMMENT '区域负责人'
) COMMENT '销售区域';

CREATE TABLE customers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(64) NOT NULL COMMENT '客户名称',
  region_id INT NOT NULL COMMENT '所属区域',
  industry VARCHAR(32) NOT NULL COMMENT '行业',
  level ENUM('A', 'B', 'C') NOT NULL DEFAULT 'B' COMMENT '客户等级',
  created_at DATE NOT NULL COMMENT '建档日期',
  CONSTRAINT fk_customers_region
    FOREIGN KEY (region_id) REFERENCES regions(id)
) COMMENT '客户';

CREATE TABLE products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sku VARCHAR(32) NOT NULL UNIQUE COMMENT 'SKU',
  name VARCHAR(64) NOT NULL COMMENT '产品名称',
  category VARCHAR(32) NOT NULL COMMENT '品类',
  unit_price DECIMAL(10, 2) NOT NULL COMMENT '标准单价（元）',
  is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否在售：1是 0否'
) COMMENT '产品';

CREATE TABLE orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_no VARCHAR(32) NOT NULL UNIQUE COMMENT '订单号',
  customer_id INT NOT NULL COMMENT '客户ID',
  order_date DATE NOT NULL COMMENT '下单日期',
  status ENUM('pending', 'paid', 'shipped', 'completed', 'cancelled')
    NOT NULL DEFAULT 'pending' COMMENT '订单状态',
  CONSTRAINT fk_orders_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
) COMMENT '订单';

CREATE TABLE order_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL COMMENT '订单ID',
  product_id INT NOT NULL COMMENT '产品ID',
  quantity INT NOT NULL COMMENT '数量',
  unit_price DECIMAL(10, 2) NOT NULL COMMENT '成交单价（元）',
  CONSTRAINT fk_items_order
    FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_items_product
    FOREIGN KEY (product_id) REFERENCES products(id)
) COMMENT '订单明细';

CREATE INDEX idx_customers_region ON customers(region_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_date ON orders(order_date);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_items_order ON order_items(order_id);
CREATE INDEX idx_items_product ON order_items(product_id);
