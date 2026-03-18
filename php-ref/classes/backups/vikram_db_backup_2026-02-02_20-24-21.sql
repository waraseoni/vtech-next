-- VTech-RSMS Backup
-- 2026-02-02 20:24:21

DROP TABLE IF EXISTS `advance_payments`;
CREATE TABLE `advance_payments` (
  `id` int(30) NOT NULL AUTO_INCREMENT,
  `mechanic_id` int(30) NOT NULL,
  `amount` float(12,2) NOT NULL DEFAULT 0.00,
  `date_paid` date NOT NULL,
  `reason` text DEFAULT NULL,
  `date_created` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=108 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `advance_payments` VALUES ('9', '2', '4000.00', '2024-10-24', '', '2025-12-24 22:14:47');
INSERT INTO `advance_payments` VALUES ('10', '2', '1000.00', '2024-11-26', '', '2025-12-24 22:16:10');
INSERT INTO `advance_payments` VALUES ('11', '2', '500.00', '2024-11-22', '', '2025-12-24 22:16:30');
INSERT INTO `advance_payments` VALUES ('12', '2', '5000.00', '2024-11-16', '', '2025-12-24 22:16:50');
INSERT INTO `advance_payments` VALUES ('13', '2', '500.00', '2024-11-15', '', '2025-12-24 22:17:09');
INSERT INTO `advance_payments` VALUES ('14', '2', '1500.00', '2024-11-14', '', '2025-12-24 22:17:34');
INSERT INTO `advance_payments` VALUES ('15', '2', '2000.00', '2024-11-11', '', '2025-12-24 22:17:48');
INSERT INTO `advance_payments` VALUES ('16', '2', '1500.00', '2024-11-07', '', '2025-12-24 22:18:03');
INSERT INTO `advance_payments` VALUES ('17', '2', '500.00', '2024-11-04', '', '2025-12-24 22:18:17');
INSERT INTO `advance_payments` VALUES ('18', '2', '2000.00', '2024-12-25', '', '2025-12-24 22:19:31');
INSERT INTO `advance_payments` VALUES ('19', '2', '1500.00', '2024-12-20', '', '2025-12-24 22:19:56');
INSERT INTO `advance_payments` VALUES ('20', '2', '5000.00', '2024-12-01', '', '2025-12-24 22:21:11');
INSERT INTO `advance_payments` VALUES ('21', '2', '850.00', '2024-12-01', '', '2025-12-24 22:21:26');
INSERT INTO `advance_payments` VALUES ('22', '2', '500.00', '2025-01-28', '', '2025-12-24 22:21:47');
INSERT INTO `advance_payments` VALUES ('23', '2', '4000.00', '2025-01-19', '', '2025-12-24 22:22:07');
INSERT INTO `advance_payments` VALUES ('24', '2', '1000.00', '2025-01-14', '', '2025-12-24 22:22:20');
INSERT INTO `advance_payments` VALUES ('25', '2', '1000.00', '2025-01-08', '', '2025-12-24 22:22:45');
INSERT INTO `advance_payments` VALUES ('26', '2', '500.00', '2025-02-27', '', '2025-12-24 22:23:08');
INSERT INTO `advance_payments` VALUES ('27', '2', '4000.00', '2025-02-10', '', '2025-12-24 22:23:22');
INSERT INTO `advance_payments` VALUES ('28', '2', '1000.00', '2025-02-05', '', '2025-12-24 22:23:38');
INSERT INTO `advance_payments` VALUES ('29', '2', '1000.00', '2025-02-03', '', '2025-12-24 22:23:52');
INSERT INTO `advance_payments` VALUES ('30', '2', '1000.00', '2025-04-27', '', '2025-12-24 22:24:04');
INSERT INTO `advance_payments` VALUES ('31', '2', '1000.00', '2025-03-27', '', '2025-12-24 22:24:24');
INSERT INTO `advance_payments` VALUES ('32', '2', '1400.00', '2025-03-23', '', '2025-12-24 22:24:56');
INSERT INTO `advance_payments` VALUES ('33', '2', '1000.00', '2025-03-12', '', '2025-12-24 22:25:10');
INSERT INTO `advance_payments` VALUES ('34', '2', '1000.00', '2025-03-27', '', '2025-12-24 22:25:45');
INSERT INTO `advance_payments` VALUES ('35', '2', '1000.00', '2025-04-22', '', '2025-12-24 22:26:03');
INSERT INTO `advance_payments` VALUES ('36', '2', '3800.00', '2025-04-20', '', '2025-12-24 22:26:35');
INSERT INTO `advance_payments` VALUES ('37', '2', '2000.00', '2025-04-15', '', '2025-12-24 22:26:47');
INSERT INTO `advance_payments` VALUES ('38', '2', '1000.00', '2025-04-11', '', '2025-12-24 22:26:59');
INSERT INTO `advance_payments` VALUES ('39', '2', '500.00', '2025-04-05', '', '2025-12-24 22:27:12');
INSERT INTO `advance_payments` VALUES ('40', '2', '3000.00', '2025-04-02', '', '2025-12-24 22:27:26');
INSERT INTO `advance_payments` VALUES ('41', '2', '3000.00', '2025-05-31', '', '2025-12-24 22:27:58');
INSERT INTO `advance_payments` VALUES ('42', '2', '2000.00', '2025-05-24', '', '2025-12-24 22:28:12');
INSERT INTO `advance_payments` VALUES ('43', '2', '5000.00', '2025-05-04', '', '2025-12-24 22:28:26');
INSERT INTO `advance_payments` VALUES ('44', '2', '1000.00', '2025-06-26', '', '2025-12-24 22:28:48');
INSERT INTO `advance_payments` VALUES ('45', '2', '1000.00', '2025-06-20', '', '2025-12-24 22:29:08');
INSERT INTO `advance_payments` VALUES ('46', '2', '1000.00', '2025-06-13', '', '2025-12-24 22:29:21');
INSERT INTO `advance_payments` VALUES ('47', '2', '3000.00', '2025-06-07', '', '2025-12-24 22:29:34');
INSERT INTO `advance_payments` VALUES ('48', '2', '300.00', '2025-07-28', '', '2025-12-24 22:29:52');
INSERT INTO `advance_payments` VALUES ('49', '2', '5000.00', '2025-07-23', '', '2025-12-24 22:30:07');
INSERT INTO `advance_payments` VALUES ('50', '2', '400.00', '2025-07-09', '', '2025-12-24 22:30:25');
INSERT INTO `advance_payments` VALUES ('51', '2', '5000.00', '2025-07-05', '', '2025-12-24 22:30:45');
INSERT INTO `advance_payments` VALUES ('52', '2', '300.00', '2025-07-03', '', '2025-12-24 22:31:02');
INSERT INTO `advance_payments` VALUES ('53', '2', '1000.00', '2025-08-28', '', '2025-12-24 22:31:16');
INSERT INTO `advance_payments` VALUES ('54', '2', '5000.00', '2025-08-24', '', '2025-12-24 22:31:30');
INSERT INTO `advance_payments` VALUES ('55', '2', '1000.00', '2025-08-16', '', '2025-12-24 22:31:45');
INSERT INTO `advance_payments` VALUES ('56', '2', '1000.00', '2025-08-14', '', '2025-12-24 22:32:00');
INSERT INTO `advance_payments` VALUES ('57', '2', '3000.00', '2025-08-02', '', '2025-12-24 22:32:11');
INSERT INTO `advance_payments` VALUES ('58', '2', '7000.00', '2025-09-24', '', '2025-12-24 22:32:39');
INSERT INTO `advance_payments` VALUES ('59', '2', '2000.00', '2025-09-15', '', '2025-12-24 22:32:55');
INSERT INTO `advance_payments` VALUES ('60', '2', '1000.00', '2025-09-11', '', '2025-12-24 22:33:09');
INSERT INTO `advance_payments` VALUES ('61', '2', '2000.00', '2025-09-09', '', '2025-12-24 22:33:22');
INSERT INTO `advance_payments` VALUES ('62', '2', '1000.00', '2025-09-06', '', '2025-12-24 22:33:36');
INSERT INTO `advance_payments` VALUES ('63', '2', '500.00', '2025-09-02', '', '2025-12-24 22:33:52');
INSERT INTO `advance_payments` VALUES ('64', '2', '1000.00', '2025-10-28', '', '2025-12-24 22:34:06');
INSERT INTO `advance_payments` VALUES ('65', '2', '5000.00', '2025-10-17', '', '2025-12-24 22:34:18');
INSERT INTO `advance_payments` VALUES ('66', '2', '1000.00', '2025-10-16', '', '2025-12-24 22:34:34');
INSERT INTO `advance_payments` VALUES ('67', '2', '7000.00', '2025-10-06', '', '2025-12-24 22:34:51');
INSERT INTO `advance_payments` VALUES ('68', '2', '1000.00', '2025-10-13', '', '2025-12-24 22:35:23');
INSERT INTO `advance_payments` VALUES ('69', '2', '5500.00', '2025-11-23', '', '2025-12-24 22:35:35');
INSERT INTO `advance_payments` VALUES ('70', '2', '500.00', '2025-11-19', '', '2025-12-24 22:35:49');
INSERT INTO `advance_payments` VALUES ('71', '2', '1000.00', '2025-11-14', '', '2025-12-24 22:36:03');
INSERT INTO `advance_payments` VALUES ('72', '2', '500.00', '2025-11-12', '', '2025-12-24 22:36:17');
INSERT INTO `advance_payments` VALUES ('73', '2', '500.00', '2025-11-08', '', '2025-12-24 22:36:28');
INSERT INTO `advance_payments` VALUES ('74', '2', '15500.00', '2025-11-04', '', '2025-12-24 22:36:46');
INSERT INTO `advance_payments` VALUES ('75', '2', '1000.00', '2025-11-02', '', '2025-12-24 22:36:57');
INSERT INTO `advance_payments` VALUES ('76', '2', '4000.00', '2025-12-24', '', '2025-12-24 22:37:11');
INSERT INTO `advance_payments` VALUES ('77', '2', '2000.00', '2025-12-19', '', '2025-12-24 22:37:58');
INSERT INTO `advance_payments` VALUES ('78', '2', '2000.00', '2025-12-12', '', '2025-12-24 22:38:09');
INSERT INTO `advance_payments` VALUES ('79', '2', '1000.00', '2025-12-07', '', '2025-12-24 22:38:21');
INSERT INTO `advance_payments` VALUES ('80', '2', '900.00', '2025-12-04', '', '2025-12-24 22:38:33');
INSERT INTO `advance_payments` VALUES ('81', '3', '400.00', '2025-12-25', '', '2025-12-26 06:48:14');
INSERT INTO `advance_payments` VALUES ('82', '3', '400.00', '2025-12-24', '', '2025-12-26 06:48:32');
INSERT INTO `advance_payments` VALUES ('83', '3', '2000.00', '2025-12-26', 'for advance 31 dec 25 tak ka', '2025-12-26 19:55:52');
INSERT INTO `advance_payments` VALUES ('85', '1', '17458.00', '2025-12-31', '', '2026-01-01 12:46:47');
INSERT INTO `advance_payments` VALUES ('86', '3', '400.00', '2026-01-02', 'cash', '2026-01-02 21:06:43');
INSERT INTO `advance_payments` VALUES ('87', '3', '450.00', '2026-01-01', 'cash', '2026-01-02 21:07:01');
INSERT INTO `advance_payments` VALUES ('88', '3', '1000.00', '2025-12-30', 'adjusted approx', '2026-01-02 21:07:28');
INSERT INTO `advance_payments` VALUES ('89', '3', '1500.00', '2026-01-02', 'online', '2026-01-02 21:11:20');
INSERT INTO `advance_payments` VALUES ('90', '1', '250.00', '2025-12-30', '', '2026-01-03 12:01:23');
INSERT INTO `advance_payments` VALUES ('91', '2', '4000.00', '2026-01-05', 'on demand', '2026-01-05 13:22:09');
INSERT INTO `advance_payments` VALUES ('92', '3', '3000.00', '2026-01-06', 'advance', '2026-01-06 16:00:50');
INSERT INTO `advance_payments` VALUES ('93', '3', '2140.00', '2026-01-12', 'Kirana from ayush', '2026-01-12 13:46:00');
INSERT INTO `advance_payments` VALUES ('94', '3', '2500.00', '2026-01-12', 'On demand', '2026-01-12 13:46:14');
INSERT INTO `advance_payments` VALUES ('95', '3', '200.00', '2026-01-12', 'Jeb se nikali', '2026-01-12 13:46:35');
INSERT INTO `advance_payments` VALUES ('96', '2', '250.00', '2026-01-13', '27771 ', '2026-01-13 13:05:25');
INSERT INTO `advance_payments` VALUES ('97', '2', '3750.00', '2026-01-13', 'on demand', '2026-01-13 20:31:29');
INSERT INTO `advance_payments` VALUES ('98', '3', '190.00', '2026-01-16', 'recharge', '2026-01-16 17:29:43');
INSERT INTO `advance_payments` VALUES ('99', '3', '2000.00', '2026-01-16', '', '2026-01-16 17:29:52');
INSERT INTO `advance_payments` VALUES ('100', '3', '300.00', '2026-01-16', 'home cash', '2026-01-16 17:30:07');
INSERT INTO `advance_payments` VALUES ('101', '3', '1000.00', '2026-01-20', '', '2026-01-22 18:47:47');
INSERT INTO `advance_payments` VALUES ('102', '3', '2000.00', '2026-01-22', '', '2026-01-22 18:47:58');
INSERT INTO `advance_payments` VALUES ('103', '2', '5000.00', '2026-01-23', 'on demand', '2026-01-23 20:10:35');
INSERT INTO `advance_payments` VALUES ('104', '2', '2000.00', '2026-01-27', 'on demand', '2026-01-27 13:51:41');
INSERT INTO `advance_payments` VALUES ('105', '2', '1000.00', '2026-01-31', 'on demand', '2026-01-31 20:45:39');
INSERT INTO `advance_payments` VALUES ('106', '1', '25000.00', '2026-02-01', '', '2026-02-02 11:09:34');
INSERT INTO `advance_payments` VALUES ('107', '3', '2000.00', '2026-02-01', '', '2026-02-02 11:10:13');

DROP TABLE IF EXISTS `attendance_list`;
CREATE TABLE `attendance_list` (
  `id` int(30) NOT NULL AUTO_INCREMENT,
  `mechanic_id` int(30) NOT NULL,
  `status` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1=Present, 0=Absent, 3=HalfDay',
  `curr_date` date NOT NULL,
  PRIMARY KEY (`id`),
  KEY `mechanic_id` (`mechanic_id`),
  CONSTRAINT `attendance_list_ibfk_1` FOREIGN KEY (`mechanic_id`) REFERENCES `mechanic_list` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=440 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `attendance_list` VALUES ('1', '2', '1', '2025-12-21');
INSERT INTO `attendance_list` VALUES ('2', '3', '2', '2025-12-21');
INSERT INTO `attendance_list` VALUES ('3', '1', '1', '2025-12-21');
INSERT INTO `attendance_list` VALUES ('4', '2', '2', '2025-12-20');
INSERT INTO `attendance_list` VALUES ('5', '3', '2', '2025-12-20');
INSERT INTO `attendance_list` VALUES ('6', '1', '1', '2025-12-20');
INSERT INTO `attendance_list` VALUES ('7', '2', '1', '2025-12-22');
INSERT INTO `attendance_list` VALUES ('8', '3', '2', '2025-12-22');
INSERT INTO `attendance_list` VALUES ('9', '1', '1', '2025-12-22');
INSERT INTO `attendance_list` VALUES ('10', '2', '1', '2025-11-21');
INSERT INTO `attendance_list` VALUES ('11', '3', '2', '2025-11-21');
INSERT INTO `attendance_list` VALUES ('12', '1', '2', '2025-11-21');
INSERT INTO `attendance_list` VALUES ('13', '3', '2', '2025-12-23');
INSERT INTO `attendance_list` VALUES ('14', '1', '1', '2025-12-10');
INSERT INTO `attendance_list` VALUES ('15', '1', '2', '2025-11-12');
INSERT INTO `attendance_list` VALUES ('16', '2', '1', '2025-12-23');
INSERT INTO `attendance_list` VALUES ('17', '1', '1', '2025-12-23');
INSERT INTO `attendance_list` VALUES ('18', '2', '1', '2025-11-19');
INSERT INTO `attendance_list` VALUES ('19', '3', '2', '2025-11-19');
INSERT INTO `attendance_list` VALUES ('20', '1', '2', '2025-11-19');
INSERT INTO `attendance_list` VALUES ('21', '2', '1', '2025-11-13');
INSERT INTO `attendance_list` VALUES ('22', '2', '2', '2025-11-11');
INSERT INTO `attendance_list` VALUES ('23', '2', '1', '2025-10-14');
INSERT INTO `attendance_list` VALUES ('24', '3', '2', '2025-10-08');
INSERT INTO `attendance_list` VALUES ('25', '1', '2', '2025-10-16');
INSERT INTO `attendance_list` VALUES ('26', '1', '2', '2025-10-22');
INSERT INTO `attendance_list` VALUES ('27', '3', '2', '2025-10-21');
INSERT INTO `attendance_list` VALUES ('28', '2', '1', '2025-12-24');
INSERT INTO `attendance_list` VALUES ('29', '3', '2', '2025-12-24');
INSERT INTO `attendance_list` VALUES ('30', '1', '1', '2025-12-24');
INSERT INTO `attendance_list` VALUES ('31', '2', '1', '2024-10-23');
INSERT INTO `attendance_list` VALUES ('32', '2', '2', '2024-11-01');
INSERT INTO `attendance_list` VALUES ('33', '2', '2', '2024-11-02');
INSERT INTO `attendance_list` VALUES ('34', '2', '2', '2024-11-03');
INSERT INTO `attendance_list` VALUES ('35', '2', '1', '2024-11-04');
INSERT INTO `attendance_list` VALUES ('36', '2', '1', '2024-11-05');
INSERT INTO `attendance_list` VALUES ('37', '2', '2', '2024-11-23');
INSERT INTO `attendance_list` VALUES ('38', '2', '2', '2024-11-27');
INSERT INTO `attendance_list` VALUES ('39', '2', '1', '2024-11-06');
INSERT INTO `attendance_list` VALUES ('40', '2', '1', '2024-11-07');
INSERT INTO `attendance_list` VALUES ('41', '2', '1', '2024-11-08');
INSERT INTO `attendance_list` VALUES ('42', '2', '1', '2024-11-09');
INSERT INTO `attendance_list` VALUES ('43', '2', '1', '2024-11-10');
INSERT INTO `attendance_list` VALUES ('44', '2', '1', '2024-11-11');
INSERT INTO `attendance_list` VALUES ('45', '2', '1', '2024-11-12');
INSERT INTO `attendance_list` VALUES ('46', '2', '1', '2024-11-13');
INSERT INTO `attendance_list` VALUES ('47', '2', '1', '2024-11-14');
INSERT INTO `attendance_list` VALUES ('48', '2', '1', '2024-11-15');
INSERT INTO `attendance_list` VALUES ('49', '2', '1', '2024-11-16');
INSERT INTO `attendance_list` VALUES ('50', '2', '1', '2024-11-17');
INSERT INTO `attendance_list` VALUES ('51', '2', '1', '2024-11-18');
INSERT INTO `attendance_list` VALUES ('52', '2', '1', '2024-11-19');
INSERT INTO `attendance_list` VALUES ('53', '2', '1', '2024-11-20');
INSERT INTO `attendance_list` VALUES ('54', '2', '1', '2024-11-21');
INSERT INTO `attendance_list` VALUES ('55', '2', '1', '2024-11-22');
INSERT INTO `attendance_list` VALUES ('56', '2', '2', '2024-11-24');
INSERT INTO `attendance_list` VALUES ('57', '2', '1', '2024-11-25');
INSERT INTO `attendance_list` VALUES ('58', '2', '1', '2024-11-26');
INSERT INTO `attendance_list` VALUES ('59', '2', '1', '2024-11-28');
INSERT INTO `attendance_list` VALUES ('60', '2', '1', '2024-11-29');
INSERT INTO `attendance_list` VALUES ('61', '2', '1', '2024-11-30');
INSERT INTO `attendance_list` VALUES ('62', '2', '1', '2024-12-01');
INSERT INTO `attendance_list` VALUES ('63', '2', '1', '2024-12-16');
INSERT INTO `attendance_list` VALUES ('64', '2', '1', '2024-12-25');
INSERT INTO `attendance_list` VALUES ('65', '2', '1', '2024-12-17');
INSERT INTO `attendance_list` VALUES ('66', '2', '1', '2024-12-18');
INSERT INTO `attendance_list` VALUES ('67', '2', '1', '2024-12-19');
INSERT INTO `attendance_list` VALUES ('68', '2', '1', '2024-12-20');
INSERT INTO `attendance_list` VALUES ('69', '2', '1', '2024-12-21');
INSERT INTO `attendance_list` VALUES ('70', '2', '1', '2024-12-22');
INSERT INTO `attendance_list` VALUES ('71', '2', '1', '2024-12-23');
INSERT INTO `attendance_list` VALUES ('72', '2', '1', '2024-12-24');
INSERT INTO `attendance_list` VALUES ('73', '2', '1', '2024-12-31');
INSERT INTO `attendance_list` VALUES ('74', '2', '1', '2025-01-01');
INSERT INTO `attendance_list` VALUES ('75', '2', '1', '2025-01-04');
INSERT INTO `attendance_list` VALUES ('76', '2', '1', '2025-01-02');
INSERT INTO `attendance_list` VALUES ('77', '2', '1', '2025-01-03');
INSERT INTO `attendance_list` VALUES ('78', '2', '1', '2025-01-13');
INSERT INTO `attendance_list` VALUES ('79', '2', '1', '2025-01-07');
INSERT INTO `attendance_list` VALUES ('80', '2', '1', '2025-01-08');
INSERT INTO `attendance_list` VALUES ('81', '2', '1', '2025-01-09');
INSERT INTO `attendance_list` VALUES ('82', '2', '1', '2025-01-10');
INSERT INTO `attendance_list` VALUES ('83', '2', '1', '2025-01-11');
INSERT INTO `attendance_list` VALUES ('84', '2', '1', '2025-01-12');
INSERT INTO `attendance_list` VALUES ('85', '2', '1', '2025-01-16');
INSERT INTO `attendance_list` VALUES ('86', '2', '1', '2025-01-21');
INSERT INTO `attendance_list` VALUES ('87', '2', '1', '2025-01-17');
INSERT INTO `attendance_list` VALUES ('88', '2', '1', '2025-01-18');
INSERT INTO `attendance_list` VALUES ('89', '2', '1', '2025-01-19');
INSERT INTO `attendance_list` VALUES ('90', '2', '1', '2025-01-20');
INSERT INTO `attendance_list` VALUES ('91', '2', '1', '2025-01-23');
INSERT INTO `attendance_list` VALUES ('92', '2', '1', '2025-01-28');
INSERT INTO `attendance_list` VALUES ('93', '2', '1', '2025-01-24');
INSERT INTO `attendance_list` VALUES ('94', '2', '1', '2025-01-25');
INSERT INTO `attendance_list` VALUES ('95', '2', '1', '2025-01-26');
INSERT INTO `attendance_list` VALUES ('96', '2', '1', '2025-01-27');
INSERT INTO `attendance_list` VALUES ('97', '2', '1', '2025-01-30');
INSERT INTO `attendance_list` VALUES ('98', '2', '1', '2025-01-31');
INSERT INTO `attendance_list` VALUES ('99', '2', '1', '2025-02-01');
INSERT INTO `attendance_list` VALUES ('100', '2', '1', '2025-02-02');
INSERT INTO `attendance_list` VALUES ('101', '2', '1', '2025-02-03');
INSERT INTO `attendance_list` VALUES ('102', '2', '1', '2025-02-07');
INSERT INTO `attendance_list` VALUES ('103', '2', '1', '2025-02-10');
INSERT INTO `attendance_list` VALUES ('104', '2', '1', '2025-02-08');
INSERT INTO `attendance_list` VALUES ('105', '2', '1', '2025-02-09');
INSERT INTO `attendance_list` VALUES ('106', '2', '1', '2025-02-12');
INSERT INTO `attendance_list` VALUES ('107', '2', '1', '2025-02-16');
INSERT INTO `attendance_list` VALUES ('108', '2', '1', '2025-02-13');
INSERT INTO `attendance_list` VALUES ('109', '2', '1', '2025-02-14');
INSERT INTO `attendance_list` VALUES ('110', '2', '1', '2025-02-15');
INSERT INTO `attendance_list` VALUES ('111', '2', '3', '2025-02-27');
INSERT INTO `attendance_list` VALUES ('112', '2', '1', '2025-03-09');
INSERT INTO `attendance_list` VALUES ('113', '2', '1', '2025-03-10');
INSERT INTO `attendance_list` VALUES ('114', '2', '1', '2025-03-11');
INSERT INTO `attendance_list` VALUES ('115', '2', '1', '2025-03-12');
INSERT INTO `attendance_list` VALUES ('116', '2', '1', '2025-03-20');
INSERT INTO `attendance_list` VALUES ('117', '2', '1', '2025-03-28');
INSERT INTO `attendance_list` VALUES ('118', '2', '1', '2025-03-21');
INSERT INTO `attendance_list` VALUES ('119', '2', '1', '2025-03-22');
INSERT INTO `attendance_list` VALUES ('120', '2', '1', '2025-03-23');
INSERT INTO `attendance_list` VALUES ('121', '2', '1', '2025-03-24');
INSERT INTO `attendance_list` VALUES ('122', '2', '1', '2025-03-25');
INSERT INTO `attendance_list` VALUES ('123', '2', '1', '2025-03-26');
INSERT INTO `attendance_list` VALUES ('124', '2', '1', '2025-03-27');
INSERT INTO `attendance_list` VALUES ('125', '2', '1', '2025-03-31');
INSERT INTO `attendance_list` VALUES ('126', '2', '1', '2025-04-01');
INSERT INTO `attendance_list` VALUES ('127', '2', '1', '2025-04-02');
INSERT INTO `attendance_list` VALUES ('128', '2', '1', '2025-04-03');
INSERT INTO `attendance_list` VALUES ('129', '2', '1', '2025-04-04');
INSERT INTO `attendance_list` VALUES ('130', '2', '1', '2025-04-05');
INSERT INTO `attendance_list` VALUES ('131', '2', '1', '2025-04-07');
INSERT INTO `attendance_list` VALUES ('132', '2', '1', '2025-04-08');
INSERT INTO `attendance_list` VALUES ('133', '2', '1', '2025-04-12');
INSERT INTO `attendance_list` VALUES ('134', '2', '1', '2025-04-23');
INSERT INTO `attendance_list` VALUES ('135', '2', '1', '2025-04-13');
INSERT INTO `attendance_list` VALUES ('136', '2', '1', '2025-04-14');
INSERT INTO `attendance_list` VALUES ('137', '2', '1', '2025-04-15');
INSERT INTO `attendance_list` VALUES ('138', '2', '1', '2025-04-16');
INSERT INTO `attendance_list` VALUES ('139', '2', '1', '2025-04-17');
INSERT INTO `attendance_list` VALUES ('140', '2', '1', '2025-04-18');
INSERT INTO `attendance_list` VALUES ('141', '2', '1', '2025-04-19');
INSERT INTO `attendance_list` VALUES ('142', '2', '1', '2025-04-20');
INSERT INTO `attendance_list` VALUES ('143', '2', '1', '2025-04-21');
INSERT INTO `attendance_list` VALUES ('144', '2', '1', '2025-04-22');
INSERT INTO `attendance_list` VALUES ('145', '2', '3', '2025-04-24');
INSERT INTO `attendance_list` VALUES ('146', '2', '1', '2025-04-25');
INSERT INTO `attendance_list` VALUES ('147', '2', '1', '2025-04-26');
INSERT INTO `attendance_list` VALUES ('148', '2', '1', '2025-04-27');
INSERT INTO `attendance_list` VALUES ('149', '2', '1', '2025-05-03');
INSERT INTO `attendance_list` VALUES ('150', '2', '1', '2025-05-04');
INSERT INTO `attendance_list` VALUES ('151', '2', '1', '2025-05-21');
INSERT INTO `attendance_list` VALUES ('152', '2', '1', '2025-05-22');
INSERT INTO `attendance_list` VALUES ('153', '2', '1', '2025-05-23');
INSERT INTO `attendance_list` VALUES ('154', '2', '1', '2025-05-24');
INSERT INTO `attendance_list` VALUES ('155', '2', '1', '2025-05-27');
INSERT INTO `attendance_list` VALUES ('156', '2', '1', '2025-05-28');
INSERT INTO `attendance_list` VALUES ('157', '2', '1', '2025-05-29');
INSERT INTO `attendance_list` VALUES ('158', '2', '1', '2025-05-30');
INSERT INTO `attendance_list` VALUES ('159', '2', '1', '2025-05-31');
INSERT INTO `attendance_list` VALUES ('160', '2', '1', '2025-06-01');
INSERT INTO `attendance_list` VALUES ('161', '2', '1', '2025-06-02');
INSERT INTO `attendance_list` VALUES ('162', '2', '1', '2025-06-03');
INSERT INTO `attendance_list` VALUES ('163', '2', '3', '2025-06-04');
INSERT INTO `attendance_list` VALUES ('164', '2', '1', '2025-06-05');
INSERT INTO `attendance_list` VALUES ('165', '2', '1', '2025-06-06');
INSERT INTO `attendance_list` VALUES ('166', '2', '1', '2025-06-07');
INSERT INTO `attendance_list` VALUES ('167', '2', '1', '2025-06-10');
INSERT INTO `attendance_list` VALUES ('168', '2', '1', '2025-06-13');
INSERT INTO `attendance_list` VALUES ('169', '2', '1', '2025-06-11');
INSERT INTO `attendance_list` VALUES ('170', '2', '1', '2025-06-12');
INSERT INTO `attendance_list` VALUES ('171', '2', '1', '2025-06-17');
INSERT INTO `attendance_list` VALUES ('172', '2', '1', '2025-06-18');
INSERT INTO `attendance_list` VALUES ('173', '2', '1', '2025-06-19');
INSERT INTO `attendance_list` VALUES ('174', '2', '1', '2025-06-20');
INSERT INTO `attendance_list` VALUES ('175', '2', '1', '2025-06-21');
INSERT INTO `attendance_list` VALUES ('176', '2', '1', '2025-06-23');
INSERT INTO `attendance_list` VALUES ('177', '2', '1', '2025-06-24');
INSERT INTO `attendance_list` VALUES ('178', '2', '1', '2025-06-25');
INSERT INTO `attendance_list` VALUES ('179', '2', '1', '2025-06-26');
INSERT INTO `attendance_list` VALUES ('180', '2', '1', '2025-06-27');
INSERT INTO `attendance_list` VALUES ('181', '2', '1', '2025-06-28');
INSERT INTO `attendance_list` VALUES ('182', '2', '1', '2025-06-29');
INSERT INTO `attendance_list` VALUES ('183', '2', '1', '2025-06-30');
INSERT INTO `attendance_list` VALUES ('184', '2', '1', '2025-07-01');
INSERT INTO `attendance_list` VALUES ('185', '2', '1', '2025-07-09');
INSERT INTO `attendance_list` VALUES ('186', '2', '1', '2025-07-02');
INSERT INTO `attendance_list` VALUES ('187', '2', '1', '2025-07-03');
INSERT INTO `attendance_list` VALUES ('188', '2', '1', '2025-07-04');
INSERT INTO `attendance_list` VALUES ('189', '2', '1', '2025-07-05');
INSERT INTO `attendance_list` VALUES ('190', '2', '1', '2025-07-06');
INSERT INTO `attendance_list` VALUES ('191', '2', '1', '2025-07-07');
INSERT INTO `attendance_list` VALUES ('192', '2', '1', '2025-07-08');
INSERT INTO `attendance_list` VALUES ('193', '2', '1', '2025-07-11');
INSERT INTO `attendance_list` VALUES ('194', '2', '1', '2025-07-14');
INSERT INTO `attendance_list` VALUES ('195', '2', '1', '2025-07-12');
INSERT INTO `attendance_list` VALUES ('196', '2', '1', '2025-07-13');
INSERT INTO `attendance_list` VALUES ('197', '2', '1', '2025-07-23');
INSERT INTO `attendance_list` VALUES ('198', '2', '1', '2025-07-25');
INSERT INTO `attendance_list` VALUES ('199', '2', '1', '2025-07-24');
INSERT INTO `attendance_list` VALUES ('200', '2', '3', '2025-07-26');
INSERT INTO `attendance_list` VALUES ('201', '2', '1', '2025-07-27');
INSERT INTO `attendance_list` VALUES ('202', '2', '1', '2025-07-28');
INSERT INTO `attendance_list` VALUES ('203', '2', '1', '2025-08-13');
INSERT INTO `attendance_list` VALUES ('204', '2', '1', '2025-08-16');
INSERT INTO `attendance_list` VALUES ('205', '2', '1', '2025-08-14');
INSERT INTO `attendance_list` VALUES ('206', '2', '1', '2025-08-15');
INSERT INTO `attendance_list` VALUES ('207', '2', '1', '2025-08-19');
INSERT INTO `attendance_list` VALUES ('208', '2', '1', '2025-08-20');
INSERT INTO `attendance_list` VALUES ('209', '2', '1', '2025-08-21');
INSERT INTO `attendance_list` VALUES ('210', '2', '3', '2025-08-22');
INSERT INTO `attendance_list` VALUES ('211', '2', '1', '2025-08-24');
INSERT INTO `attendance_list` VALUES ('212', '2', '1', '2025-08-25');
INSERT INTO `attendance_list` VALUES ('213', '2', '1', '2025-08-26');
INSERT INTO `attendance_list` VALUES ('214', '2', '1', '2025-08-27');
INSERT INTO `attendance_list` VALUES ('215', '2', '1', '2025-08-28');
INSERT INTO `attendance_list` VALUES ('216', '2', '1', '2025-08-29');
INSERT INTO `attendance_list` VALUES ('217', '2', '1', '2025-08-30');
INSERT INTO `attendance_list` VALUES ('218', '2', '1', '2025-08-31');
INSERT INTO `attendance_list` VALUES ('219', '2', '1', '2025-09-01');
INSERT INTO `attendance_list` VALUES ('220', '2', '1', '2025-09-08');
INSERT INTO `attendance_list` VALUES ('221', '2', '1', '2025-09-02');
INSERT INTO `attendance_list` VALUES ('222', '2', '1', '2025-09-03');
INSERT INTO `attendance_list` VALUES ('223', '2', '1', '2025-09-04');
INSERT INTO `attendance_list` VALUES ('224', '2', '1', '2025-09-05');
INSERT INTO `attendance_list` VALUES ('225', '2', '1', '2025-09-06');
INSERT INTO `attendance_list` VALUES ('226', '2', '1', '2025-09-07');
INSERT INTO `attendance_list` VALUES ('227', '2', '1', '2025-09-10');
INSERT INTO `attendance_list` VALUES ('228', '2', '1', '2025-09-15');
INSERT INTO `attendance_list` VALUES ('229', '2', '1', '2025-09-14');
INSERT INTO `attendance_list` VALUES ('230', '2', '1', '2025-09-11');
INSERT INTO `attendance_list` VALUES ('231', '2', '1', '2025-09-12');
INSERT INTO `attendance_list` VALUES ('232', '2', '1', '2025-09-13');
INSERT INTO `attendance_list` VALUES ('233', '2', '1', '2025-09-18');
INSERT INTO `attendance_list` VALUES ('234', '2', '1', '2025-09-28');
INSERT INTO `attendance_list` VALUES ('235', '2', '1', '2025-09-19');
INSERT INTO `attendance_list` VALUES ('236', '2', '1', '2025-09-20');
INSERT INTO `attendance_list` VALUES ('237', '2', '1', '2025-09-21');
INSERT INTO `attendance_list` VALUES ('238', '2', '1', '2025-09-22');
INSERT INTO `attendance_list` VALUES ('239', '2', '1', '2025-09-23');
INSERT INTO `attendance_list` VALUES ('240', '2', '1', '2025-09-24');
INSERT INTO `attendance_list` VALUES ('241', '2', '1', '2025-09-25');
INSERT INTO `attendance_list` VALUES ('242', '2', '1', '2025-09-26');
INSERT INTO `attendance_list` VALUES ('243', '2', '1', '2025-09-27');
INSERT INTO `attendance_list` VALUES ('244', '2', '1', '2025-10-01');
INSERT INTO `attendance_list` VALUES ('245', '2', '1', '2025-10-02');
INSERT INTO `attendance_list` VALUES ('246', '2', '1', '2025-10-03');
INSERT INTO `attendance_list` VALUES ('247', '2', '1', '2025-10-04');
INSERT INTO `attendance_list` VALUES ('248', '2', '1', '2025-10-05');
INSERT INTO `attendance_list` VALUES ('249', '2', '1', '2025-10-07');
INSERT INTO `attendance_list` VALUES ('250', '2', '1', '2025-10-08');
INSERT INTO `attendance_list` VALUES ('251', '2', '1', '2025-10-09');
INSERT INTO `attendance_list` VALUES ('252', '2', '3', '2025-10-10');
INSERT INTO `attendance_list` VALUES ('253', '2', '1', '2025-10-11');
INSERT INTO `attendance_list` VALUES ('254', '2', '1', '2025-10-12');
INSERT INTO `attendance_list` VALUES ('255', '2', '1', '2025-10-17');
INSERT INTO `attendance_list` VALUES ('256', '2', '1', '2025-10-15');
INSERT INTO `attendance_list` VALUES ('257', '2', '1', '2025-10-16');
INSERT INTO `attendance_list` VALUES ('258', '2', '1', '2025-10-24');
INSERT INTO `attendance_list` VALUES ('259', '2', '1', '2025-10-25');
INSERT INTO `attendance_list` VALUES ('260', '2', '1', '2025-10-26');
INSERT INTO `attendance_list` VALUES ('261', '2', '1', '2025-10-27');
INSERT INTO `attendance_list` VALUES ('262', '2', '1', '2025-10-28');
INSERT INTO `attendance_list` VALUES ('263', '2', '1', '2025-10-29');
INSERT INTO `attendance_list` VALUES ('264', '2', '1', '2025-10-30');
INSERT INTO `attendance_list` VALUES ('265', '2', '1', '2025-10-31');
INSERT INTO `attendance_list` VALUES ('266', '2', '1', '2025-11-02');
INSERT INTO `attendance_list` VALUES ('267', '2', '1', '2025-11-03');
INSERT INTO `attendance_list` VALUES ('268', '2', '1', '2025-11-05');
INSERT INTO `attendance_list` VALUES ('269', '2', '3', '2025-11-06');
INSERT INTO `attendance_list` VALUES ('270', '2', '1', '2025-11-07');
INSERT INTO `attendance_list` VALUES ('271', '2', '1', '2025-11-08');
INSERT INTO `attendance_list` VALUES ('272', '2', '1', '2025-11-09');
INSERT INTO `attendance_list` VALUES ('273', '2', '1', '2025-11-10');
INSERT INTO `attendance_list` VALUES ('274', '2', '1', '2025-11-12');
INSERT INTO `attendance_list` VALUES ('275', '2', '1', '2025-11-23');
INSERT INTO `attendance_list` VALUES ('276', '2', '1', '2025-11-14');
INSERT INTO `attendance_list` VALUES ('277', '2', '1', '2025-11-15');
INSERT INTO `attendance_list` VALUES ('278', '2', '1', '2025-11-16');
INSERT INTO `attendance_list` VALUES ('279', '2', '1', '2025-11-17');
INSERT INTO `attendance_list` VALUES ('280', '2', '1', '2025-11-18');
INSERT INTO `attendance_list` VALUES ('281', '2', '1', '2025-11-20');
INSERT INTO `attendance_list` VALUES ('282', '2', '1', '2025-11-22');
INSERT INTO `attendance_list` VALUES ('283', '2', '1', '2025-12-06');
INSERT INTO `attendance_list` VALUES ('284', '2', '1', '2025-12-07');
INSERT INTO `attendance_list` VALUES ('285', '2', '1', '2025-12-09');
INSERT INTO `attendance_list` VALUES ('286', '2', '1', '2025-12-18');
INSERT INTO `attendance_list` VALUES ('287', '2', '1', '2025-12-10');
INSERT INTO `attendance_list` VALUES ('288', '2', '1', '2025-12-11');
INSERT INTO `attendance_list` VALUES ('289', '2', '1', '2025-12-12');
INSERT INTO `attendance_list` VALUES ('290', '2', '1', '2025-12-13');
INSERT INTO `attendance_list` VALUES ('291', '2', '1', '2025-12-14');
INSERT INTO `attendance_list` VALUES ('292', '2', '1', '2025-12-15');
INSERT INTO `attendance_list` VALUES ('293', '2', '1', '2025-12-16');
INSERT INTO `attendance_list` VALUES ('294', '2', '1', '2025-12-17');
INSERT INTO `attendance_list` VALUES ('295', '2', '2', '2025-12-19');
INSERT INTO `attendance_list` VALUES ('296', '2', '1', '2025-12-25');
INSERT INTO `attendance_list` VALUES ('297', '3', '1', '2025-12-25');
INSERT INTO `attendance_list` VALUES ('298', '1', '1', '2025-12-25');
INSERT INTO `attendance_list` VALUES ('299', '2', '1', '2025-12-26');
INSERT INTO `attendance_list` VALUES ('300', '3', '1', '2025-12-26');
INSERT INTO `attendance_list` VALUES ('301', '1', '1', '2025-12-26');
INSERT INTO `attendance_list` VALUES ('302', '1', '1', '2025-12-01');
INSERT INTO `attendance_list` VALUES ('303', '1', '1', '2025-12-02');
INSERT INTO `attendance_list` VALUES ('304', '1', '1', '2025-12-03');
INSERT INTO `attendance_list` VALUES ('305', '1', '1', '2025-12-04');
INSERT INTO `attendance_list` VALUES ('306', '1', '1', '2025-12-05');
INSERT INTO `attendance_list` VALUES ('307', '1', '1', '2025-12-06');
INSERT INTO `attendance_list` VALUES ('308', '1', '1', '2025-12-07');
INSERT INTO `attendance_list` VALUES ('309', '1', '1', '2025-12-08');
INSERT INTO `attendance_list` VALUES ('310', '1', '1', '2025-12-09');
INSERT INTO `attendance_list` VALUES ('311', '2', '1', '2025-12-27');
INSERT INTO `attendance_list` VALUES ('312', '2', '1', '2025-12-28');
INSERT INTO `attendance_list` VALUES ('313', '3', '1', '2025-12-27');
INSERT INTO `attendance_list` VALUES ('314', '3', '1', '2025-12-28');
INSERT INTO `attendance_list` VALUES ('315', '1', '1', '2025-12-11');
INSERT INTO `attendance_list` VALUES ('316', '1', '1', '2025-12-12');
INSERT INTO `attendance_list` VALUES ('317', '1', '1', '2025-12-13');
INSERT INTO `attendance_list` VALUES ('318', '1', '1', '2025-12-14');
INSERT INTO `attendance_list` VALUES ('319', '1', '1', '2025-12-15');
INSERT INTO `attendance_list` VALUES ('320', '1', '1', '2025-12-16');
INSERT INTO `attendance_list` VALUES ('321', '1', '1', '2025-12-17');
INSERT INTO `attendance_list` VALUES ('322', '1', '1', '2025-12-18');
INSERT INTO `attendance_list` VALUES ('323', '1', '1', '2025-12-19');
INSERT INTO `attendance_list` VALUES ('324', '1', '1', '2025-12-27');
INSERT INTO `attendance_list` VALUES ('325', '1', '1', '2025-12-28');
INSERT INTO `attendance_list` VALUES ('326', '2', '2', '2025-12-08');
INSERT INTO `attendance_list` VALUES ('327', '2', '2', '2025-12-01');
INSERT INTO `attendance_list` VALUES ('328', '2', '2', '2025-12-02');
INSERT INTO `attendance_list` VALUES ('329', '2', '2', '2025-12-03');
INSERT INTO `attendance_list` VALUES ('330', '2', '2', '2025-12-04');
INSERT INTO `attendance_list` VALUES ('331', '2', '2', '2025-12-05');
INSERT INTO `attendance_list` VALUES ('332', '2', '1', '2025-12-29');
INSERT INTO `attendance_list` VALUES ('333', '3', '1', '2025-12-29');
INSERT INTO `attendance_list` VALUES ('334', '1', '1', '2025-12-29');
INSERT INTO `attendance_list` VALUES ('335', '2', '1', '2025-12-30');
INSERT INTO `attendance_list` VALUES ('336', '3', '1', '2025-12-30');
INSERT INTO `attendance_list` VALUES ('337', '1', '1', '2025-12-30');
INSERT INTO `attendance_list` VALUES ('338', '1', '1', '2025-12-31');
INSERT INTO `attendance_list` VALUES ('339', '2', '3', '2025-12-31');
INSERT INTO `attendance_list` VALUES ('340', '3', '1', '2025-12-31');
INSERT INTO `attendance_list` VALUES ('341', '2', '2', '2026-01-01');
INSERT INTO `attendance_list` VALUES ('342', '3', '1', '2026-01-01');
INSERT INTO `attendance_list` VALUES ('343', '1', '1', '2026-01-01');
INSERT INTO `attendance_list` VALUES ('344', '2', '1', '2026-01-02');
INSERT INTO `attendance_list` VALUES ('345', '3', '1', '2026-01-02');
INSERT INTO `attendance_list` VALUES ('346', '1', '1', '2026-01-02');
INSERT INTO `attendance_list` VALUES ('347', '2', '1', '2026-01-03');
INSERT INTO `attendance_list` VALUES ('348', '3', '1', '2026-01-03');
INSERT INTO `attendance_list` VALUES ('349', '1', '1', '2026-01-03');
INSERT INTO `attendance_list` VALUES ('350', '2', '1', '2026-01-04');
INSERT INTO `attendance_list` VALUES ('351', '3', '1', '2026-01-04');
INSERT INTO `attendance_list` VALUES ('352', '1', '1', '2026-01-04');
INSERT INTO `attendance_list` VALUES ('353', '2', '1', '2026-01-05');
INSERT INTO `attendance_list` VALUES ('354', '3', '1', '2026-01-05');
INSERT INTO `attendance_list` VALUES ('355', '1', '1', '2026-01-05');
INSERT INTO `attendance_list` VALUES ('356', '2', '1', '2026-01-06');
INSERT INTO `attendance_list` VALUES ('357', '3', '1', '2026-01-06');
INSERT INTO `attendance_list` VALUES ('358', '1', '1', '2026-01-06');
INSERT INTO `attendance_list` VALUES ('359', '2', '1', '2026-01-07');
INSERT INTO `attendance_list` VALUES ('360', '3', '1', '2026-01-07');
INSERT INTO `attendance_list` VALUES ('361', '1', '1', '2026-01-07');
INSERT INTO `attendance_list` VALUES ('362', '2', '1', '2026-01-08');
INSERT INTO `attendance_list` VALUES ('363', '3', '1', '2026-01-08');
INSERT INTO `attendance_list` VALUES ('364', '1', '1', '2026-01-08');
INSERT INTO `attendance_list` VALUES ('365', '2', '1', '2026-01-09');
INSERT INTO `attendance_list` VALUES ('366', '3', '1', '2026-01-09');
INSERT INTO `attendance_list` VALUES ('367', '1', '1', '2026-01-09');
INSERT INTO `attendance_list` VALUES ('368', '2', '1', '2026-01-10');
INSERT INTO `attendance_list` VALUES ('369', '3', '1', '2026-01-10');
INSERT INTO `attendance_list` VALUES ('370', '1', '1', '2026-01-10');
INSERT INTO `attendance_list` VALUES ('371', '2', '1', '2026-01-11');
INSERT INTO `attendance_list` VALUES ('372', '3', '1', '2026-01-11');
INSERT INTO `attendance_list` VALUES ('373', '1', '1', '2026-01-11');
INSERT INTO `attendance_list` VALUES ('374', '2', '1', '2026-01-12');
INSERT INTO `attendance_list` VALUES ('375', '3', '1', '2026-01-12');
INSERT INTO `attendance_list` VALUES ('376', '1', '1', '2026-01-12');
INSERT INTO `attendance_list` VALUES ('377', '2', '1', '2026-01-13');
INSERT INTO `attendance_list` VALUES ('378', '3', '1', '2026-01-13');
INSERT INTO `attendance_list` VALUES ('379', '1', '1', '2026-01-13');
INSERT INTO `attendance_list` VALUES ('380', '2', '1', '2026-01-15');
INSERT INTO `attendance_list` VALUES ('381', '3', '1', '2026-01-15');
INSERT INTO `attendance_list` VALUES ('382', '1', '1', '2026-01-15');
INSERT INTO `attendance_list` VALUES ('383', '2', '1', '2026-01-14');
INSERT INTO `attendance_list` VALUES ('384', '3', '1', '2026-01-14');
INSERT INTO `attendance_list` VALUES ('385', '1', '1', '2026-01-14');
INSERT INTO `attendance_list` VALUES ('386', '1', '1', '2026-01-16');
INSERT INTO `attendance_list` VALUES ('387', '2', '1', '2026-01-16');
INSERT INTO `attendance_list` VALUES ('388', '3', '1', '2026-01-16');
INSERT INTO `attendance_list` VALUES ('389', '2', '1', '2026-01-17');
INSERT INTO `attendance_list` VALUES ('390', '1', '1', '2026-01-17');
INSERT INTO `attendance_list` VALUES ('391', '2', '1', '2026-01-19');
INSERT INTO `attendance_list` VALUES ('392', '3', '1', '2026-01-19');
INSERT INTO `attendance_list` VALUES ('393', '1', '1', '2026-01-19');
INSERT INTO `attendance_list` VALUES ('394', '2', '1', '2026-01-18');
INSERT INTO `attendance_list` VALUES ('395', '3', '1', '2026-01-18');
INSERT INTO `attendance_list` VALUES ('396', '1', '1', '2026-01-18');
INSERT INTO `attendance_list` VALUES ('397', '2', '1', '2026-01-20');
INSERT INTO `attendance_list` VALUES ('398', '3', '1', '2026-01-20');
INSERT INTO `attendance_list` VALUES ('399', '1', '1', '2026-01-20');
INSERT INTO `attendance_list` VALUES ('400', '2', '1', '2026-01-21');
INSERT INTO `attendance_list` VALUES ('401', '3', '1', '2026-01-21');
INSERT INTO `attendance_list` VALUES ('402', '1', '1', '2026-01-21');
INSERT INTO `attendance_list` VALUES ('403', '1', '1', '2026-01-22');
INSERT INTO `attendance_list` VALUES ('404', '2', '1', '2026-01-22');
INSERT INTO `attendance_list` VALUES ('405', '3', '1', '2026-01-22');
INSERT INTO `attendance_list` VALUES ('406', '2', '1', '2026-01-23');
INSERT INTO `attendance_list` VALUES ('407', '3', '1', '2026-01-23');
INSERT INTO `attendance_list` VALUES ('408', '1', '1', '2026-01-23');
INSERT INTO `attendance_list` VALUES ('409', '3', '1', '2026-01-17');
INSERT INTO `attendance_list` VALUES ('410', '2', '1', '2026-01-24');
INSERT INTO `attendance_list` VALUES ('411', '3', '1', '2026-01-24');
INSERT INTO `attendance_list` VALUES ('412', '1', '1', '2026-01-24');
INSERT INTO `attendance_list` VALUES ('413', '2', '1', '2026-01-25');
INSERT INTO `attendance_list` VALUES ('414', '3', '1', '2026-01-25');
INSERT INTO `attendance_list` VALUES ('415', '1', '1', '2026-01-25');
INSERT INTO `attendance_list` VALUES ('416', '2', '1', '2026-01-29');
INSERT INTO `attendance_list` VALUES ('417', '2', '1', '2026-01-28');
INSERT INTO `attendance_list` VALUES ('418', '2', '1', '2026-01-27');
INSERT INTO `attendance_list` VALUES ('419', '2', '1', '2026-01-26');
INSERT INTO `attendance_list` VALUES ('420', '3', '1', '2026-01-29');
INSERT INTO `attendance_list` VALUES ('421', '3', '1', '2026-01-28');
INSERT INTO `attendance_list` VALUES ('422', '3', '1', '2026-01-27');
INSERT INTO `attendance_list` VALUES ('423', '3', '1', '2026-01-26');
INSERT INTO `attendance_list` VALUES ('424', '1', '1', '2026-01-29');
INSERT INTO `attendance_list` VALUES ('425', '1', '1', '2026-01-28');
INSERT INTO `attendance_list` VALUES ('426', '1', '1', '2026-01-27');
INSERT INTO `attendance_list` VALUES ('427', '1', '1', '2026-01-26');
INSERT INTO `attendance_list` VALUES ('428', '2', '2', '2026-01-30');
INSERT INTO `attendance_list` VALUES ('429', '3', '1', '2026-01-30');
INSERT INTO `attendance_list` VALUES ('430', '1', '1', '2026-01-30');
INSERT INTO `attendance_list` VALUES ('431', '2', '1', '2026-01-31');
INSERT INTO `attendance_list` VALUES ('432', '3', '1', '2026-01-31');
INSERT INTO `attendance_list` VALUES ('433', '1', '1', '2026-01-31');
INSERT INTO `attendance_list` VALUES ('434', '2', '2', '2026-02-02');
INSERT INTO `attendance_list` VALUES ('435', '3', '1', '2026-02-02');
INSERT INTO `attendance_list` VALUES ('436', '1', '1', '2026-02-02');
INSERT INTO `attendance_list` VALUES ('437', '2', '1', '2026-02-01');
INSERT INTO `attendance_list` VALUES ('438', '3', '1', '2026-02-01');
INSERT INTO `attendance_list` VALUES ('439', '1', '1', '2026-02-01');

DROP TABLE IF EXISTS `client_list`;
CREATE TABLE `client_list` (
  `id` int(30) NOT NULL AUTO_INCREMENT,
  `firstname` text NOT NULL,
  `middlename` text DEFAULT NULL,
  `lastname` text NOT NULL,
  `contact` varchar(100) NOT NULL,
  `email` text NOT NULL,
  `address` text NOT NULL,
  `image_path` text DEFAULT NULL,
  `opening_balance` decimal(15,2) DEFAULT 0.00,
  `delete_flag` tinyint(1) NOT NULL DEFAULT 0,
  `date_created` datetime NOT NULL DEFAULT current_timestamp(),
  `date_updated` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=217 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `client_list` VALUES ('1', 'Devendra ', 'Arti', 'Namdeo', '07987953757', 'devendran@vtech.com', 'Namdeo Electronics, Ganesh Chowk, Seoni', '', '0.00', '0', '2021-12-27 10:10:55', '');
INSERT INTO `client_list` VALUES ('2', 'Shubhank', '', 'Patel', '08817444419', 'shubbhank@vtech.com', 'Shobhit Light, Bilhari, jabalpur', 'uploads/clients/client00002.jpg', '31450.00', '0', '2021-12-27 10:33:18', '');
INSERT INTO `client_list` VALUES ('3', 'Vikram', '', 'Jain', '9179105875', 'vik.vtech@gmail.com', 'Wright town jabalpur', '', '-5000.00', '0', '2025-10-22 16:48:56', '');
INSERT INTO `client_list` VALUES ('4', 'preeti', 'vikram', 'jain', '9893036221', 'preetijn65@gmail.com', 'Wright town, jabalpur', '', '0.00', '0', '2025-10-23 01:55:16', '');
INSERT INTO `client_list` VALUES ('5', 'Deepak', '', 'Rajak', '9131852254', 'Drajak288@gmail.com ', 'Kanchghar', '', '0.00', '0', '2025-10-24 14:45:58', '');
INSERT INTO `client_list` VALUES ('6', 'Vijay', 'Kumar', 'Barman', '8305256826', 'vijaybarman022@gmail.com', 'VS Light
chhoti khermai, devrikala, Panagar', '', '0.00', '0', '2025-10-24 15:00:54', '');
INSERT INTO `client_list` VALUES ('7', 'Ashish', '', 'Jain', '8839131819', 'Ashishj@vtech.com', 'Jabalpur', '', '0.00', '0', '2025-10-24 15:46:29', '');
INSERT INTO `client_list` VALUES ('8', 'Ankit', '', 'Patel kareli', '6263930111', 'ankitpatel0763@gmail.com', 'Kareli', '', '0.00', '0', '2025-10-25 12:35:48', '');
INSERT INTO `client_list` VALUES ('9', 'Raju', '', 'kori', '9131876763', 'rajukori@vtech.com', 'jabalpur', '', '0.00', '0', '2025-10-23 15:07:36', '');
INSERT INTO `client_list` VALUES ('10', 'Shashank', '', 'Yadav', '7999704569', 'shashank@vtech', 'jabalpur', '', '0.00', '0', '2025-10-25 15:12:31', '');
INSERT INTO `client_list` VALUES ('11', 'Nitesh', '', 'Shivbedi', '9755377987', 'nitesh@vtech.com', 'Maa Sound Seoni', '', '0.00', '0', '2025-10-26 20:51:33', '');
INSERT INTO `client_list` VALUES ('12', 'Rakesh ', '', 'Choudhary', '9109282290', 'r@vtech.com', 'Anurag pachori bhaiya ke yaha ka hai jabalpur', '', '0.00', '0', '2025-10-26 20:55:24', '');
INSERT INTO `client_list` VALUES ('13', 'Neeraj ', '', 'Choudhary', '7869882724', 'neeraj@vtech.com', 'jabalpur', '', '0.00', '0', '2025-10-27 20:59:36', '');
INSERT INTO `client_list` VALUES ('14', 'Vikash', '', 'Mehra', '6264723290', 'not provided', 'Jabalpur', '', '0.00', '0', '2025-10-27 21:13:57', '');
INSERT INTO `client_list` VALUES ('15', 'Jitendra', '', 'Dubey', '7415970794', 'not provided by jitendra', 'jabalpur', '', '0.00', '0', '2025-10-27 21:19:40', '');
INSERT INTO `client_list` VALUES ('16', 'Sandeep', '', 'Kalsi', '9977755564', 'not given', 'jabalpur', '', '0.00', '0', '2025-10-27 21:27:10', '');
INSERT INTO `client_list` VALUES ('17', 'Raghav', '', 'rajak', '7400923161', '9752680862', 'Jabalpur', 'uploads/clients/client00017.jpg', '0.00', '0', '2025-10-27 21:31:23', '');
INSERT INTO `client_list` VALUES ('18', 'Priyanshu', '', 'Yadav', '7489117456', 'ypriyanshu006@gmail.com', 'B Craft Events jabalpur, 9109883955 , ', '', '0.00', '0', '2025-10-28 21:56:18', '');
INSERT INTO `client_list` VALUES ('19', 'Vimal', '', 'Gupta', '8319261747', '9691717347', 'Gupta Tent And Light, Ganga Sagar, Jabalpur', 'uploads/clients/client00019.jpg', '0.00', '0', '2025-10-28 23:59:19', '');
INSERT INTO `client_list` VALUES ('20', 'Aniket', 'Yadav', 'Rajkumar', '9303384741', 'not given by aniket', 'jabalpur', '', '0.00', '0', '2025-10-29 19:05:45', '');
INSERT INTO `client_list` VALUES ('21', 'Kanha', '', 'Patel', '8305336464', 'not given by kanha', 'Belkhadu', '', '0.00', '0', '2025-10-29 19:12:36', '');
INSERT INTO `client_list` VALUES ('22', 'Ashish', 'Patel', 'Mandla', '9977189680', 'ashispatel41@gmail.com', 'Ashish Light House, Mandla, 7000623265', '', '0.00', '0', '2025-10-29 19:16:27', '');
INSERT INTO `client_list` VALUES ('23', 'Mukesh', '', 'Kosthi', '9098385859', 'not Given by mukesh', 'jabalpur', '', '0.00', '0', '2025-10-29 19:21:59', '');
INSERT INTO `client_list` VALUES ('24', 'Deepak', 'Sahu', 'Rohit', '8982208191', 'ds9395351@gmail.com', 'Divy DJ jabalpur', '', '0.00', '0', '2025-10-29 19:23:28', '');
INSERT INTO `client_list` VALUES ('25', 'Rakesh', 'Nema', 'Ghansor', '7772942194', 'not given by rakesh', 'Ghansor', '', '0.00', '0', '2025-10-29 19:24:33', '');
INSERT INTO `client_list` VALUES ('26', 'Manoj', 'Kumar', 'Bajaj', '9300636397', 'Not given by manoj', 'Shiv Shakti Mobile, Jabalpur ', '', '0.00', '0', '2025-10-29 14:21:42', '');
INSERT INTO `client_list` VALUES ('27', 'Mukesh', '', 'Balwani', '9425410705', 'not given by mukeh', 'Jabalpur', '', '0.00', '0', '2025-10-24 21:11:24', '');
INSERT INTO `client_list` VALUES ('28', 'Viplob', '', 'Datta', '8269955531', 'viplobdutta007@gmail.com', 'B-Craft Bilhery Jabalpur', 'uploads/clients/client00028.jpg', '0.00', '0', '2025-10-24 21:17:09', '');
INSERT INTO `client_list` VALUES ('29', 'Dr.v.', 'k.', 'purwar', '9826372324', 'not given dr.', 'Jabalpur', '', '0.00', '0', '2025-11-02 18:40:28', '');
INSERT INTO `client_list` VALUES ('30', 'Gourav', 'zone', 'light', '6266669281', '', 'Jabalpur (m.p)', '', '2500.00', '0', '2025-11-02 18:48:45', '');
INSERT INTO `client_list` VALUES ('31', 'Vikas', 'thakur', 'Mandla', '9977735835', 'Not Given vikas', 'Mandla', '', '0.00', '0', '2025-11-02 19:14:21', '');
INSERT INTO `client_list` VALUES ('32', 'Afroz', 'khan', '', '9826143376', '8770830766', 'Shafan Infotech, old bus stand, Jabalpur', '', '0.00', '0', '2025-11-02 19:29:51', '');
INSERT INTO `client_list` VALUES ('33', 'Raja', 'Verma', 'Kanch ghar', '7440568876', 'not given raja', 'Kanch ghar jabalpur', '', '0.00', '0', '2025-11-02 19:39:25', '');
INSERT INTO `client_list` VALUES ('34', 'Rishi', 'Zone', 'Katni', '9131120066', 'not given rishi', 'Katni', '', '0.00', '0', '2025-11-02 19:47:04', '');
INSERT INTO `client_list` VALUES ('35', 'Wazib', 'khan', 'Arham interprises', '9993626999', 'not given Wazib', 'Gohalpur', '', '0.00', '0', '2025-11-02 20:28:38', '');
INSERT INTO `client_list` VALUES ('36', 'Shiv', 'kachhi', 'Panagar', '7974604156', 'shivkachhi182@gmail.com', 'Panagar', '', '0.00', '0', '2025-11-02 20:39:08', '');
INSERT INTO `client_list` VALUES ('37', 'Kanha', 'Soni ', 'Bijawar', '9522752576', 'Not give by kanha', 'Kanha DJ Bijawar ', '', '0.00', '0', '2025-11-03 13:34:24', '');
INSERT INTO `client_list` VALUES ('38', 'Dabbu', 'Bhaiya', 'Led wall', '9827210812', 'Not provide by dabbu', 'Jabalpur', '', '0.00', '0', '2025-11-03 20:44:14', '');
INSERT INTO `client_list` VALUES ('39', 'Ravi', 'Tivari', 'unique prashant', '9806010101', 'not given by ravi', 'jabalpur', '', '0.00', '0', '2025-11-04 14:38:18', '');
INSERT INTO `client_list` VALUES ('40', 'Anand', 'Led', 'Wall', '9755101362', 'not given by anand', 'Jabalpur', '', '0.00', '0', '2025-11-05 11:43:50', '');
INSERT INTO `client_list` VALUES ('41', 'Amit', 'Tiwari ', 'Baloon Event ', '7999774765', 'not give by amit', 'Ghamapur', '', '0.00', '0', '2025-11-05 13:16:56', '');
INSERT INTO `client_list` VALUES ('42', 'Veenu YATHARTH', '', 'NORIYA', '8085555934', 'noriyayatharth216@gmail.com', 'Hathital Laxmi Colony', '', '0.00', '0', '2025-11-06 19:14:20', '');
INSERT INTO `client_list` VALUES ('43', 'Sourabh', 'Sing Rohit', 'divy dj', '7987611997', 'rohit@vtech.com', 'Divy Dj, Jabalpur', '', '0.00', '0', '2025-11-07 01:20:50', '');
INSERT INTO `client_list` VALUES ('44', 'Shubham', 'Chakrawarti', 'LedWall', '9644100412', 'shubham@vtech.com', 'Jabalpur', '', '0.00', '0', '2025-11-07 01:22:30', '');
INSERT INTO `client_list` VALUES ('45', 'GodWin', 'Gregory', 'Boby', '9479749242', 'Gpdwin@vtech.com', 'Jabalpur', '', '0.00', '0', '2025-11-07 01:23:35', '');
INSERT INTO `client_list` VALUES ('46', 'Shubham ', 'Mishra Maharaj ', 'Narsinghpur ', '7415262578', 'dr.mishrashubham143@gmail.com', 'Maharaj Light and sfx, Narsinghpur , 7415262578, 7000639409', 'uploads/clients/client00046.jpg', '0.00', '0', '2025-11-07 12:38:05', '');
INSERT INTO `client_list` VALUES ('47', 'Vijay ', 'Tamrakar ', 'Katni', '9340384060', 'vinayaklight@gmail.com', 'Vinayak Lights, Katni', 'uploads/clients/client00047.jpg', '0.00', '0', '2025-11-07 12:42:29', '');
INSERT INTO `client_list` VALUES ('48', 'Anil', 'Gupta', 'Xenium Infotech', '9300100162', 'xeniumanil@gmail.com', 'Xenium Infotech Jabalpur', '', '0.00', '0', '2025-11-09 15:30:08', '');
INSERT INTO `client_list` VALUES ('49', 'Ballu', 'DJ', 'Mandla', '8602148577', 'ballu@vtech.com', 'mandla', '', '0.00', '0', '2025-11-09 15:32:10', '');
INSERT INTO `client_list` VALUES ('50', 'Arun', 'Sahu', 'Dindori', '8959711126', 'arun@vtech.com', 'Dindori ', '', '0.00', '0', '2025-11-11 14:45:28', '');
INSERT INTO `client_list` VALUES ('51', 'Sagar ', 'Verma', 'Kanch ghar ', '9926350153', 'vermaschandresh1@gmail.com', 'Kanch ghar, Jabalpur ', 'uploads/clients/client00051.jpg', '0.00', '0', '2025-11-11 14:47:06', '');
INSERT INTO `client_list` VALUES ('52', 'Rajendra ', '', 'Kewat', '7489088252', 'kewat@vtech.com', 'Jabalpur ', '', '0.00', '0', '2025-11-11 14:50:43', '');
INSERT INTO `client_list` VALUES ('53', 'Prateek ', 'Jain', 'Panagar ', '6265200614', 'prateek@vtech.com', 'Panagar, Jabalpur ', 'uploads/clients/client00053.jpg', '0.00', '0', '2025-11-11 14:52:09', '');
INSERT INTO `client_list` VALUES ('54', 'Ashok', 'Choudhary', 'Rajendra Vishwakarma', '9425155839', 'ashok@vtech.com', 'Jabalpur', '', '0.00', '0', '2025-11-12 23:04:05', '');
INSERT INTO `client_list` VALUES ('55', 'Shifa', 'Video', 'Iqrar', '9300158969', 'shifa@vtech.com', 'Jabalpur', '', '0.00', '0', '2025-11-12 23:05:53', '');
INSERT INTO `client_list` VALUES ('56', 'Rahul', '', 'Kanwajiya', '9399294561', 'rahul@vtech.com', 'Jabalpur', '', '0.00', '0', '2025-11-12 23:07:36', '');
INSERT INTO `client_list` VALUES ('57', 'Rinku', '', 'Sahu', '9630434785', 'rinku@vtech.com', 'Jabalpur', '', '0.00', '0', '2025-11-12 23:08:35', '');
INSERT INTO `client_list` VALUES ('58', 'Amit', 'Namdeo', 'DJ Cyclone', '8319689023', 'cyclone@vtech.com', 'Jabalpur', '', '0.00', '0', '2025-11-12 23:10:48', '');
INSERT INTO `client_list` VALUES ('59', 'Ajay', 'Patel', 'Ajju', '9329765243', 'djnareshjbp@gmail.com', 'Garha, Jabalpur', '', '0.00', '0', '2025-11-12 23:14:16', '');
INSERT INTO `client_list` VALUES ('60', 'Akash', 'Kushwaha', 'Gadarwara', '9098665936', 'akaskk5936@gmail.com', 'Aakash Audio, Gadarwara', '', '0.00', '0', '2025-11-13 14:03:57', '');
INSERT INTO `client_list` VALUES ('61', 'Ashish', '', 'Soni', '9329273286', 'asoni@vtech.com', 'jabalpur', 'uploads/clients/client00061.jpg', '0.00', '0', '2025-11-13 20:32:21', '');
INSERT INTO `client_list` VALUES ('62', 'Deepak', 'Bramh', 'Galgala', '9340680465', 'deepak@vtech.com', 'Galgala, jabalpur', 'uploads/clients/client00062.jpg', '0.00', '0', '2025-11-13 20:34:07', '');
INSERT INTO `client_list` VALUES ('63', 'Manish', 'Vishwakarma', 'Galgala', '9407049144', 'manish@vtech.com', 'Jabalpur', 'uploads/clients/client00063.jpg', '0.00', '0', '2025-11-13 20:37:01', '');
INSERT INTO `client_list` VALUES ('64', 'Anil', 'Panjwani', 'Katni', '9300279510', 'anilpanjwani2255@gmail.com', 'LD Sound and Events katni', 'uploads/clients/client00064.jpg', '0.00', '0', '2025-11-14 13:34:57', '');
INSERT INTO `client_list` VALUES ('65', 'Vishal ', 'Thakur ', 'Royal Event ', '8770313297', 'royal @vtech.con', 'Royal Event, Jabalpur 
', 'uploads/clients/client00065.jpg', '0.00', '0', '2025-11-15 12:35:20', '');
INSERT INTO `client_list` VALUES ('66', 'Abhijeet ', 'Chourasia ', 'MR Event Effects ', '7987909300', 'Abhijeetchourasia84@gmail.com', 'MR Event and Effects Jabalpur ', 'uploads/clients/client00066.jpg', '0.00', '0', '2025-11-15 16:53:24', '');
INSERT INTO `client_list` VALUES ('67', 'Rahul', 'Dehariya', 'Palari', '9399746817', 'rahul_nihal@vtech.com', 'Palari, Seoni', '', '0.00', '0', '2025-11-16 12:54:09', '');
INSERT INTO `client_list` VALUES ('68', 'Tanu', '', 'Thakur', '7987143279', 'tanu@vtech.com', 'Jabalpur', 'uploads/clients/client00068.jpg', '0.00', '0', '2025-11-16 12:55:10', '');
INSERT INTO `client_list` VALUES ('69', 'Rajat', '', 'Chandrikapure', '8889005551', '', 'RS Servises, Sakkardara, Nagpur', '', '0.00', '0', '2025-11-16 14:29:41', '');
INSERT INTO `client_list` VALUES ('70', 'Pawan ', '', 'Sen', '7879686972', 'Pawan78@gmail.com', '', '', '0.00', '0', '2025-11-16 16:57:43', '');
INSERT INTO `client_list` VALUES ('71', 'Pradeep', 'Yadav', 'Ghansor', '7489429963', 'pradeepya575@gmail.com', 'Ghansor', 'uploads/clients/client00071.jpg', '0.00', '0', '2025-11-16 19:20:11', '');
INSERT INTO `client_list` VALUES ('72', 'Shubham ', '', 'Yadav', '9009312888', 'Shubham2@gmail.com', 'Radhika Mobile', '', '0.00', '0', '2025-11-17 12:43:19', '');
INSERT INTO `client_list` VALUES ('73', 'Vinay', 'Gupta', 'Seoni', '9993585626', 'vinay@vtech.com', 'shakti sound,seoni', '', '0.00', '0', '2025-11-17 14:29:21', '');
INSERT INTO `client_list` VALUES ('74', 'Neelesh', 'Gupta', 'Gadarwara', '8103030333', 'neelesh@vtech.com', 'Gadarwara', '', '0.00', '0', '2025-11-17 14:32:22', '');
INSERT INTO `client_list` VALUES ('75', 'Tirath', 'koshta', 'kanhiya Audio', '9303985994', 'teerathkosta7@gmail.com', 'Jabalpur', '', '0.00', '0', '2025-11-17 15:30:02', '');
INSERT INTO `client_list` VALUES ('76', 'Ritik', 'Sahu', 'maa mobile', '8305778347', 'ritik@vtech.com', 'Jabalpur', '', '0.00', '0', '2025-11-17 15:45:24', '');
INSERT INTO `client_list` VALUES ('77', 'Rajendra', 'kushwaha', 'Jabalpur', '7987973581', 'rajendra@vtech.com', 'Jabalpur', '', '0.00', '0', '2025-11-17 18:38:06', '');
INSERT INTO `client_list` VALUES ('78', 'Ashish', 'Shrivas', 'ashi print', '9329512051', 'ashimobilejbp@gmail.com', 'Ashi Print, HariOm Market beside nagar nigam jabalpur', '', '0.00', '0', '2025-11-18 17:54:57', '');
INSERT INTO `client_list` VALUES ('79', 'hemant', '', 'mehra', '9111180559', 'hemantmehra0316@gmail.com', 'jabalpur', 'uploads/clients/client00079.jpg', '0.00', '0', '2025-11-18 18:15:10', '');
INSERT INTO `client_list` VALUES ('80', 'Rahul', '', 'Radium Point', '9303799212', 'rahulradium@vtech.com', 'Radium Point, Civic center, jabalpur', '', '0.00', '0', '2025-11-18 18:20:20', '');
INSERT INTO `client_list` VALUES ('81', 'Pokhraj', 'pappu', 'Warkade', '6264570640', 'pappu@vtech.com', 'Chourai', '', '0.00', '0', '2025-11-18 18:21:41', '');
INSERT INTO `client_list` VALUES ('82', 'Vikash', 'Sen', 'Quaidi Khana', '7999723643', 'quaidikhana@vtech.com', 'Quaidi Khana, Jabalpur', '', '0.00', '0', '2025-11-18 18:24:13', '');
INSERT INTO `client_list` VALUES ('83', 'Pradeep', 'Upadhyay', 'Pipariya', '8821932101', 'pradeep@vtech.com', 'Pipariya', '', '0.00', '0', '2025-11-21 12:43:06', '');
INSERT INTO `client_list` VALUES ('84', 'Bablu', 'Projector', 'Ledwall', '7247052808', 'bablu@vtech.com', 'Jbabalpur', '', '0.00', '0', '2025-11-21 12:45:17', '');
INSERT INTO `client_list` VALUES ('85', 'Jitendra', 'Sing', 'LedWall', '9300756524', 'jitendra@vtech.com', 'Adhartal, Jabalpur', '', '0.00', '0', '2025-11-21 12:47:48', '');
INSERT INTO `client_list` VALUES ('86', 'Shubham', 'Vishwakarma', 'Shubh Light', '8602603252', 'shubhlightjbp@gmail.com', 'Shubh Light, Garha, Jabalpur', '', '0.00', '0', '2025-11-21 12:55:11', '');
INSERT INTO `client_list` VALUES ('87', 'Ayush', 'Gontiya', 'Panagar', '7804941515', 'ayush@vtech.com', 'Ak light panagar', '', '0.00', '1', '2025-11-21 17:56:49', '');
INSERT INTO `client_list` VALUES ('88', 'Ayush ', 'Gotiya', 'Panagar', '7804941514', 'ayush11@gmail.com', '', '', '0.00', '0', '2025-11-22 15:49:13', '');
INSERT INTO `client_list` VALUES ('89', 'Rahul', '', 'yadav', '8839473244', 'rahul11@vtech.com', '', '', '0.00', '0', '2025-11-22 15:59:18', '');
INSERT INTO `client_list` VALUES ('90', 'amresh ', '', 'kumar', '8109987527', 'amresh1@gmail.com', '', '', '0.00', '0', '2025-11-22 16:02:55', '');
INSERT INTO `client_list` VALUES ('91', 'Nehul ', '', 'Sharpy', '7869375453', 'nehul1@gmail.com', '', '', '0.00', '0', '2025-11-22 16:07:02', '');
INSERT INTO `client_list` VALUES ('92', 'Raja ', '', 'Ruhi sound', '9893615518', 'rohi1@gmail.com', '', '', '0.00', '0', '2025-11-22 16:11:47', '');
INSERT INTO `client_list` VALUES ('93', 'Ankit ', 'Soni', 'katni', '6261441428', 'ankitsoni@vtech.com', 'Katni', '', '0.00', '0', '2025-11-22 21:35:01', '');
INSERT INTO `client_list` VALUES ('94', 'Manish', '', 'Takhtani', '8839802011', 'takhtani', 'Manish cargo Jabalpur', '', '0.00', '0', '2025-11-22 21:43:05', '');
INSERT INTO `client_list` VALUES ('95', 'Hardik', 'Vedi', 'Narsigpur', '8889982428', 'rudrasinghvedi929@gmail.com', 'Narsingpur', '', '0.00', '0', '2025-12-03 10:47:04', '');
INSERT INTO `client_list` VALUES ('96', 'Sourabh', 'Gupta', 'Bahoriband', '9340927684', 'sgbband', 'Bahoriband', '', '0.00', '0', '2025-12-03 10:48:42', '');
INSERT INTO `client_list` VALUES ('97', 'Amar', 'Patel', 'Maneri', '7224071499', 'amar@vtech.com', 'Ameri, Jabalpur', '', '0.00', '0', '2025-12-03 10:50:14', '');
INSERT INTO `client_list` VALUES ('98', 'Harsh', 'barman', '', '9009468932', 'harsh@vtech.com', 'Jabalpur', '', '0.00', '0', '2025-12-03 10:51:51', '');
INSERT INTO `client_list` VALUES ('99', 'Dilip', 'Kushwaha', 'Panagar', '7879754550', 'dilip@vtech.com', 'Sai Mobile, DJ Light , Panagar', '', '0.00', '0', '2025-12-03 10:53:21', '');
INSERT INTO `client_list` VALUES ('100', 'Ashutosh ', 'Jain', 'Manglam', '9893010431', 'code.asam@gmail.com', 'Manglam Electronics, Maa Shakti Complex, Old Bus stand, Jabalpur ', '', '0.00', '0', '2025-12-03 12:15:21', '');
INSERT INTO `client_list` VALUES ('101', 'Honey', 'Navik', 'Seoni', '9098293324', 'aadityanavik17@gmail.com', 'Shivay Light, seoni', '', '0.00', '0', '2025-12-03 13:04:58', '');
INSERT INTO `client_list` VALUES ('102', 'Ankit ', '', 'choudhary ', '6264602787', 'ankitchoudhary111111@gmail.com', 'Ghamapur , 7067395138', '', '0.00', '0', '2025-12-03 14:28:37', '');
INSERT INTO `client_list` VALUES ('103', 'Pintu ', 'pintu ', 'choudhary ', '8982786657', 'naveen choudhary @4744gmail.cim', 'Damoh naka ', '', '0.00', '0', '2025-12-03 14:59:23', '');
INSERT INTO `client_list` VALUES ('104', 'Ashish ', 'Patel', 'Tilwara', '9755555118', 'astilwara@vtech.com', 'Ashish DJ, Tilwara ', '', '0.00', '0', '2025-12-03 15:46:21', '');
INSERT INTO `client_list` VALUES ('105', 'Sanjay', 'Barman', 'Chulha golai', '6264078417', 'schulha@vtech.com', 'Chulha golai jabalpur ghana', 'uploads/clients/client00105.jpg', '0.00', '0', '2025-12-03 15:47:50', '');
INSERT INTO `client_list` VALUES ('106', 'Shiv Kumar', 'Patel', 'Suhagi', '9303127338', 'suhagi @vtech.com', 'Suhagi', '', '0.00', '0', '2025-12-03 16:56:50', '');
INSERT INTO `client_list` VALUES ('107', 'Virendra ', 'Kushwaha ', 'Panagar ', '7067725205', 'virendrakushwaha498@gmail.com', 'Shree  Light, Panagar ', '', '0.00', '0', '2025-12-03 19:23:48', '');
INSERT INTO `client_list` VALUES ('108', 'sourabh ', 'ankit', 'suman', '9329090143', '2335sourabhsuman@gmail.com', 'Phootataal jabalpur', '', '0.00', '0', '2025-12-03 19:30:09', '');
INSERT INTO `client_list` VALUES ('109', 'Shushil', 'Sahu', 'Gudda', '9301200093', 'sainathgudda@gmail.com', 'badi khermai, jabalpur', 'uploads/clients/client00109.jpg', '0.00', '0', '2025-12-04 13:49:12', '');
INSERT INTO `client_list` VALUES ('110', 'Pankaj', 'Rai', 'Manjholi', '7089685202', 'pakajrai@vtech.com', 'Bachaiya, manjholi, jabalpur', '', '0.00', '0', '2025-12-04 14:00:44', '');
INSERT INTO `client_list` VALUES ('111', 'Vishal', 'Singh', 'Thakur', '8770313297', 'royal event@vtechgmail,com', 'Jabalpur', '', '0.00', '1', '2025-12-04 15:20:21', '');
INSERT INTO `client_list` VALUES ('112', 'sharukh ', 'Shah ', 'ghamapur ', '6267929826', 'shahrukhank2737@gmail.com', 'Ghamapur ', '', '0.00', '0', '2025-12-05 17:03:36', '');
INSERT INTO `client_list` VALUES ('113', 'Ikbal ', 'Mansoori ', 'Shikara', '8989278910', '8989278910', '', 'uploads/clients/client00113.jpg', '0.00', '0', '2025-12-07 14:15:28', '');
INSERT INTO `client_list` VALUES ('114', 'sant', 'kumar', 'kapil bhai jayanti ', '9424668954', 'santnsdc2014@gmail.com', 'Gour, jabalpur ', '', '0.00', '0', '2025-12-07 15:19:10', '');
INSERT INTO `client_list` VALUES ('115', 'Mohit ', '', 'Sharma ', '6264001374', '6264001374', '', '', '0.00', '0', '2025-12-07 15:50:58', '');
INSERT INTO `client_list` VALUES ('116', 'Ritik ', '', 'Sahu ', '8305778347', '8305778347', '', '', '0.00', '1', '2025-12-07 19:41:02', '');
INSERT INTO `client_list` VALUES ('117', 'Pradeep ', '', 'Upadhyay', '8821932101', '8821932101', '', '', '0.00', '1', '2025-12-09 12:34:41', '');
INSERT INTO `client_list` VALUES ('118', 'Aditya', 'Sahu', 'Nainpur', '9644388343', '9644388343', 'Jagdamba, Nainpur', 'uploads/clients/client00118.jpg', '0.00', '0', '2025-12-09 14:08:33', '');
INSERT INTO `client_list` VALUES ('119', 'Rohit ', 'Sahu', 'Divy DJ', '8319803365', '8319803365', 'Shastri Nagar, Medical, gupteshwer', '', '0.00', '0', '2025-12-09 20:20:51', '');
INSERT INTO `client_list` VALUES ('120', 'Anuj ', '', 'Majhi', '9111421654', '9111421654', '', '', '0.00', '0', '2025-12-10 12:14:49', '');
INSERT INTO `client_list` VALUES ('121', 'Shivam ', '', 'Sahu', '9770210332', '9770210332', '', '', '0.00', '0', '2025-12-10 15:03:14', '');
INSERT INTO `client_list` VALUES ('122', 'Anshul', 'Sahu', 'Kanhiwara, Seoni', '8817286518', '9165002767', 'Mahadev Light, Kanhiwara, Seoni', 'uploads/clients/client00122.jpg', '0.00', '0', '2025-12-10 17:40:29', '');
INSERT INTO `client_list` VALUES ('123', 'Anadi', 'Mishra', 'DJ Gopi', '7869533008', 'anadimishra029@gmail.com', '37, lordganj, jabalpur', '', '0.00', '0', '2025-12-10 19:41:33', '');
INSERT INTO `client_list` VALUES ('124', 'Sonu', 'Yadav', 'Sandeep Kalsi', '9755961883', '9755961883', 'gorakhpur, jabalpur', '', '0.00', '0', '2025-12-10 21:22:25', '');
INSERT INTO `client_list` VALUES ('125', 'Vikram', 'Jain', 'Vtech', '9179105875', 'vtech.jbp@gmail.com', 'jabalpur', '', '0.00', '1', '2025-12-11 12:50:03', '');
INSERT INTO `client_list` VALUES ('126', 'Vikram', 'Jain', 'Vtech', '9179105875', 'vtech.jbp@gmail.com', 'jabalpur', '', '0.00', '1', '2025-12-11 12:55:48', '');
INSERT INTO `client_list` VALUES ('127', 'vikram', '', 'jain', '9179105875', 'hhjhjhj', 'hjhj', '', '0.00', '1', '2025-12-11 12:57:56', '');
INSERT INTO `client_list` VALUES ('128', 'Ankit ', 'Jain', 'computer ', '9826543134', 'ankit.jbp87@gmail.com', 'Shree Parsva Computer, Jabalpur ', '', '0.00', '0', '2025-12-11 18:55:43', '');
INSERT INTO `client_list` VALUES ('129', 'Prakash ', 'Gotiya', 'Mandla', '7987158266', '7987158266', '', 'uploads/clients/client00129.jpg', '0.00', '0', '2025-12-12 15:20:39', '');
INSERT INTO `client_list` VALUES ('130', 'Sanjay ', 'Namdev', 'Sapna marketing ', '9993918675', '', 'Bajaj service jabalpur ', '', '0.00', '0', '2025-12-12 17:17:37', '');
INSERT INTO `client_list` VALUES ('131', 'Lucky mobile ', '', '', '8103070724', '8103070724', '', '', '0.00', '0', '2025-12-13 13:22:29', '');
INSERT INTO `client_list` VALUES ('132', 'aneesh soni', '', 'soni', '8839767548', 'aneeshsoni61@gmail.com', 'Rambo Light MJ, Seoni', '', '0.00', '0', '2025-12-13 18:32:10', '');
INSERT INTO `client_list` VALUES ('133', 'nilesh ', '', 'ahirwar', '9098103306', 'ahirwarnilesh406@gmail.com', 'Nainpur diss mandla jamgaon', '', '0.00', '0', '2025-12-14 11:16:36', '');
INSERT INTO `client_list` VALUES ('134', 'Sourabh', 'Kushwaha', 'Ranjhi', '8109607447', 'siurabhkushwaha81@gmail.com', 'Sourabh Light and DJ, Ranjhi, Jabalpur', '', '0.00', '0', '2025-12-14 12:17:14', '');
INSERT INTO `client_list` VALUES ('135', 'Ashish', 'Sahu', 'Kundam, shahpura', '8109921766', 'sahudjashish@gmail.com', 'Bhawani Sound, Kundam, Shahpura', '', '0.00', '0', '2025-12-15 12:14:04', '');
INSERT INTO `client_list` VALUES ('136', 'Praveen ', '', 'Vishwakarma', '9301373100', '9301373100', '', '', '0.00', '0', '2025-12-15 18:14:02', '');
INSERT INTO `client_list` VALUES ('137', 'Atul ', '', 'Chourasiya', '8878528351', '8878528351', '', '', '0.00', '0', '2025-12-17 15:27:21', '');
INSERT INTO `client_list` VALUES ('138', 'Vivek', 'Newait', 'VN Light', '7000786195', 'viveknewait678@gmail.com', 'VN Light, Lalmati ghamapur ', '', '0.00', '0', '2025-12-19 13:48:28', '');
INSERT INTO `client_list` VALUES ('139', 'Atish', 'Sahu', 'Gotegaon ', '9302323629', '9302323629', 'Gotegaon ', '', '0.00', '0', '2025-12-19 15:50:53', '');
INSERT INTO `client_list` VALUES ('140', 'Neelesh', 'Lanjewar', 'Neelu', '6263171638', 'djninky.89@gmail.com', 'Jabalpur', '', '0.00', '0', '2025-12-20 14:46:00', '');
INSERT INTO `client_list` VALUES ('141', 'Shailendra', 'Balaiya', 'Ranjhi', '9300122223', 'monubalaiya2222@gmail.com', 'Ranjhi', 'uploads/clients/client00141.jpg', '0.00', '0', '2025-12-20 14:52:53', '');
INSERT INTO `client_list` VALUES ('142', 'Raja ', 'Parte', 'Seoni ', '8821854742', '', 'Rs, light seoni', '', '7500.00', '0', '2025-12-23 14:29:31', '');
INSERT INTO `client_list` VALUES ('143', 'Reetesh ', 'lodhi ', 'nsp ', '7898717775', '', 'narsinghpur dhangidhana
shubham maharaj ', '', '0.00', '0', '2025-12-23 14:35:31', '');
INSERT INTO `client_list` VALUES ('144', 'Shanu ', 'Gupta', 'Katni ', '9870090372', '', 'Katni ', '', '0.00', '0', '2025-12-24 14:32:19', '');
INSERT INTO `client_list` VALUES ('145', 'Rahul ', '', 'Gupta ', '7000164959', '', 'Gohalpur', '', '0.00', '0', '2025-12-24 15:04:34', '');
INSERT INTO `client_list` VALUES ('146', 'siddhi', '', 'jain', '123456789', '', 'jabalpur waraseoni', '', '500.00', '0', '2025-12-24 21:34:46', '');
INSERT INTO `client_list` VALUES ('147', 'Anurag', 'Pachori', 'HiTech', '9200000030', '', 'Hitech CT Scan', '', '0.00', '0', '2025-12-25 12:54:14', '');
INSERT INTO `client_list` VALUES ('148', 'Rohit ', '', 'Soni ', '9754841534', '', '', '', '0.00', '0', '2025-12-25 13:45:01', '');
INSERT INTO `client_list` VALUES ('149', 'Arjun ', 'Barmaniya ', 'Mandla', '9977881757', '', 'Mandla', 'uploads/clients/client00149.jpg', '0.00', '0', '2025-12-26 14:37:52', '');
INSERT INTO `client_list` VALUES ('150', 'Abhishek rajak ', '', 'Rajak jabalpur ', '7692842551', '', 'Chota fuhara meloniganj jabalpur ', '', '0.00', '0', '2025-12-26 16:26:03', '');
INSERT INTO `client_list` VALUES ('151', 'Ranjeet ', '', 'Rajpoot gosalpur', '9993111137', '', 'Gosalpur', 'uploads/clients/client00151.png', '0.00', '0', '2025-12-26 17:48:34', '');
INSERT INTO `client_list` VALUES ('152', 'manish', 'gupta', 'bindu bhaiya', '9770556444', 'manish.gupta556444@gmail.con', 'Bindu light galagal tirha', '', '0.00', '0', '2025-12-27 13:36:07', '');
INSERT INTO `client_list` VALUES ('153', 'Shashwat Chourasiya', 'Dadi ki bagiya', 'Mandla ', '7000916742', '', 'Mandla ', 'uploads/clients/client00153.jpg', '0.00', '0', '2025-12-27 13:42:20', '');
INSERT INTO `client_list` VALUES ('154', 'Sahfuddin ', '', 'Ansari ', '9755664412', '9300116578', 'Jabalpur', '', '0.00', '0', '2025-12-27 15:01:02', '');
INSERT INTO `client_list` VALUES ('155', 'Vishal ', 'B', 'Gwalwansh', '8767542139', 'vishalgwal@yahoo.com', '205, IBD Royal City, Lamhetaghat Road, Jabalpur', '', '0.00', '0', '2025-12-27 15:37:05', '');
INSERT INTO `client_list` VALUES ('156', 'Monu ', '', 'Kushwaha panagar', '8889788187', '', 'Panagar', '', '0.00', '0', '2025-12-28 12:19:27', '');
INSERT INTO `client_list` VALUES ('157', 'SR l', '', 'Light jabalpur ', '9302307062', '', 'Jabalpur ', '', '0.00', '0', '2025-12-28 14:18:59', '');
INSERT INTO `client_list` VALUES ('158', 'Rajesh', 'Yadav', 'Bichhiya', '6263091168', 'rajeshyadavmandla1995@gmail.com', 'Ward no15 bichhiya', '', '0.00', '0', '2025-12-29 15:21:06', '');
INSERT INTO `client_list` VALUES ('159', 'Rafiq ', 'Ansari', 'Ledwall', '9827208669', '', 'Jabalpur', '', '0.00', '0', '2025-12-29 18:28:40', '');
INSERT INTO `client_list` VALUES ('160', 'Pankaj', 'Nema', 'CCTV', '9424357709', '', 'jabalpur', '', '0.00', '0', '2025-12-29 20:31:51', '');
INSERT INTO `client_list` VALUES ('161', 'Saleem', 'Khan', 'NiceTech', '7999274791', 'khan.saleem258@gmail.com', 'Jabalpur', '', '0.00', '0', '2025-12-30 19:02:49', '');
INSERT INTO `client_list` VALUES ('162', 'Net Ram', 'Kosta', 'Dhanvantari Nagar', '9826167292', '', 'Lata tent, jabalpur', '', '0.00', '0', '2025-12-31 17:50:51', '');
INSERT INTO `client_list` VALUES ('163', 'Shekh', 'Asif', 'Taj Mobile sahpura bhitoni ', '7999090988', '', 'Sahpura bhitoni ', '', '0.00', '0', '2026-01-02 12:55:25', '');
INSERT INTO `client_list` VALUES ('164', 'Sumit ', '', 'Chouhan', '9303766767', '', 'Jain tower jabalpur', '', '0.00', '0', '2026-01-03 14:13:14', '');
INSERT INTO `client_list` VALUES ('165', 'Pradeep', 'Sing', 'Tomar', '9425160387', 'pradeepjbp.ups@gmail.com', 'gfs 10, samdariya akarshan complex, ghamapur chowk, jabalpur', 'uploads/clients/client00165.jpg', '0.00', '0', '2026-01-03 19:42:39', '');
INSERT INTO `client_list` VALUES ('166', 'Dilshad', 'Ansari', 'Arsh', '9074411119', 'dilshadaryan@gmail.com', 'raddi chowki jabalpur', '', '0.00', '0', '2026-01-05 13:28:54', '');
INSERT INTO `client_list` VALUES ('167', 'Ayaan ', '', 'Khan', '9770478615', 'ayaankhan2901@gmail.com', 'Sihora', '', '0.00', '0', '2026-01-05 14:38:46', '');
INSERT INTO `client_list` VALUES ('168', 'Dharmendra', 'Kesarwani', 'Rippu bhai', '9893589080', '', 'Hathital,  kripal chowk, jabalpur', '', '0.00', '0', '2026-01-05 16:25:32', '');
INSERT INTO `client_list` VALUES ('169', 'Anurag ', 'Sahu', 'Ajeet Mobile', '7828839708', '7722994212', 'Ajeet Mobile, Jabalpur ', 'uploads/clients/client00169.jpg', '0.00', '0', '2026-01-06 13:40:10', '');
INSERT INTO `client_list` VALUES ('170', 'Ajay ', '', 'Jaiswal jabalpur ', '9425867475', '', 'Jabalpur ajay traders', '', '0.00', '0', '2026-01-07 13:43:58', '');
INSERT INTO `client_list` VALUES ('171', 'Harsh', 'Tiwari', 'Ghansor', '9201368584', 'harshtiwari17122004@gmail.com, 6260893246', 'Maruti Light, ghansor', '', '0.00', '0', '2026-01-07 16:30:32', '');
INSERT INTO `client_list` VALUES ('172', 'Teji singh ', '', 'Lodhi damoh', '7000316964', '', 'Damoh', '', '0.00', '0', '2026-01-08 17:30:04', '');
INSERT INTO `client_list` VALUES ('173', 'hemant', 'anshu', 'mehra', '7894561230', 'sdsdssdsdsd', 'sasdsdsdfs', '', '0.00', '1', '2026-01-08 19:28:17', '');
INSERT INTO `client_list` VALUES ('174', 'Vashu', '', 'Kushwaha', '6267262453', '', 'Sachin mobile', '', '0.00', '0', '2026-01-09 15:57:38', '');
INSERT INTO `client_list` VALUES ('175', 'Vedansh', 'Gupta', 'Vinay Decorators', '9827214554', 'vedanshgupta1901@gmail.com', '299/1shri nath ki taliya, marhatal jabalpur.mp', '', '0.00', '0', '2026-01-10 14:57:38', '');
INSERT INTO `client_list` VALUES ('176', 'Vikram ', 'J', 'K', '9898989898', '', 'Ghhhhggg', '', '0.00', '1', '2026-01-10 16:04:17', '');
INSERT INTO `client_list` VALUES ('177', 'Dj rs abhilash ', '', 'Choudhary ', '9303903974', '', 'Seetla mai jabalpur', '', '0.00', '0', '2026-01-10 17:06:33', '');
INSERT INTO `client_list` VALUES ('178', 'Sunil', 'Srivastav', 'The mobile care ', '9303567771', '', 'Jayanti complex', 'uploads/clients/client00178.jpg', '0.00', '0', '2026-01-10 18:29:28', '');
INSERT INTO `client_list` VALUES ('179', 'vik', 'test', 'test', '7777877878', '', 'ryrtytry', '', '0.00', '1', '2026-01-10 20:06:10', '');
INSERT INTO `client_list` VALUES ('180', 'Akash', 'Choudhary', 'Damohnaka', '9171173393', '', 'Akash DJ & Light', 'uploads/clients/client00180.png', '0.00', '0', '2026-01-11 15:39:08', '');
INSERT INTO `client_list` VALUES ('181', 'Shivendra ', 'Gupta ', 'Satna', '8269127777', '8305421382', 'Great Event Wedding management, Stana', 'uploads/clients/client00181.jpg', '0.00', '0', '2026-01-12 14:36:58', '');
INSERT INTO `client_list` VALUES ('182', 'Rajesh ', '', 'Jyotishi', '9425808911', '', 'Dhanmantri nagar jabalpur', '', '0.00', '0', '2026-01-12 15:25:21', '');
INSERT INTO `client_list` VALUES ('183', 'Dev ', '', 'Soni', '7470590506', '', 'Sarafa jabalpur ', '', '0.00', '0', '2026-01-13 15:30:17', '');
INSERT INTO `client_list` VALUES ('184', 'Roshan ', '', 'Vishwakarma ', '9144231157', '', 'Trimurti nagar ', '', '0.00', '0', '2026-01-14 12:55:45', '');
INSERT INTO `client_list` VALUES ('185', 'Sanju ', 'Yadav ', ' Tarang, Mandla ', '6262907604', '9131456690', 'Yadav tent, Mandla', 'uploads/clients/client00185.jpg', '0.00', '0', '2026-01-14 17:55:24', '');
INSERT INTO `client_list` VALUES ('186', 'Amit ', 'Patel', 'Tarang, Mandla', '9131456690', '', 'Tarang Tent, Mandla.', 'uploads/clients/client00186.jpg', '62250.00', '0', '2026-01-14 18:26:08', '');
INSERT INTO `client_list` VALUES ('187', 'Durgesh ', 'Rajpoot', ' Ranjhi', '9300692229', '', 'Ranjhi jabalpur ', 'uploads/clients/client00187.jpg', '0.00', '0', '2026-01-14 20:07:36', '');
INSERT INTO `client_list` VALUES ('188', 'Abhishek', 'samad', 'Railway loundry', '8827274658', 'samadabhishek5@gmail.com', 'coching depo near indira market, railway station , jabalpur', 'uploads/clients/client00188.png', '0.00', '0', '2026-01-16 17:36:10', '');
INSERT INTO `client_list` VALUES ('189', 'Durgesh ', '', 'Soni sahpura bhitoni ', '7000991241', '', 'Sahpura bhitoni ', 'uploads/clients/client00189.jpg', '0.00', '0', '2026-01-17 16:56:56', '');
INSERT INTO `client_list` VALUES ('190', 'sourabh', 'Yadav', 'Seoni', '7617231663', 'sourabhyadav4813@gmail.com', 'Shubh light seoni mp 22', 'uploads/clients/client00190.jpg', '0.00', '0', '2026-01-18 17:30:43', '');
INSERT INTO `client_list` VALUES ('191', 'Sahil ', 'Yadav ', 'Rampur ', '9340354208', 'yadavsahil48790@gmail.com', 'SY Light, Rampur ', 'uploads/clients/client00191.jpg', '0.00', '0', '2026-01-19 11:50:47', '');
INSERT INTO `client_list` VALUES ('192', 'Rajveer ', 'Khurana ', 'Rippu Bhai ', '9300991313', '', 'Veer events , madan Mahal ', 'uploads/clients/client00192.jpg', '0.00', '0', '2026-01-19 16:36:01', '');
INSERT INTO `client_list` VALUES ('193', 'Pooran', 'Katariya', 'Maa Bhawani', '7999475652', '', 'Jabalpur', '', '0.00', '0', '2026-01-20 17:55:32', '');
INSERT INTO `client_list` VALUES ('194', 'Aditya ', 'Sukl ', 'Belbag', '7999277651', '', 'Belbag jabalpur', '', '0.00', '0', '2026-01-20 18:36:18', '');
INSERT INTO `client_list` VALUES ('195', 'siddhi', '', 'jain', '8855885588', '', 'ssasas', '', '0.00', '1', '2026-01-21 13:01:50', '');
INSERT INTO `client_list` VALUES ('196', 'Nihal', 'Dehriya', 'Palari', '9425890672', '', 'Palari, Seoni', '', '0.00', '0', '2026-01-21 15:28:17', '');
INSERT INTO `client_list` VALUES ('197', 'Ashok', 'Varma', 'Industrial ', '9993088022', '', 'Jabalpur', 'uploads/clients/client00197.jpg', '0.00', '0', '2026-01-21 20:35:51', '');
INSERT INTO `client_list` VALUES ('198', 'Sumit', 'Kanojiya', 'zero To infinity ', '9179999543', '', 'Jabalpur', 'uploads/clients/client00198.jpg', '0.00', '0', '2026-01-21 20:58:19', '');
INSERT INTO `client_list` VALUES ('199', 'Doulat ', 'Bhorel ', 'Ghamapur ', '8319749679', '', '', '', '0.00', '0', '2026-01-22 16:18:28', '');
INSERT INTO `client_list` VALUES ('200', 'Shubham ', 'Rajak ', 'Gorakhpur', '9343257997', '', 'Gorakhpur jabalpur', '', '0.00', '0', '2026-01-24 17:30:43', '');
INSERT INTO `client_list` VALUES ('201', 'Sahil', 'Patel', 'Panagar', '8889194793', '', 'Panagar jabalpur ', '', '0.00', '0', '2026-01-25 15:33:01', '');
INSERT INTO `client_list` VALUES ('202', 'sanju', 'rajak', 'dada sarkar', '7509601780', 'sanjurajak.sr41@gmail.com', 'Near Shani mandire civil court sihora jabalpur ', 'uploads/clients/client00202.jpg', '0.00', '0', '2026-01-26 17:35:39', '');
INSERT INTO `client_list` VALUES ('203', 'Raja', 'Bhujwa', 'Sidhi', '9755141653', '9131379908', 'Shankar Sound, Sidhi ', 'uploads/clients/client00203.jpg', '0.00', '0', '2026-01-27 11:11:53', '');
INSERT INTO `client_list` VALUES ('204', 'yaseen', 'ansari', 'master eng and polymer', '7400636768', '', 'Gohalpur, jabalpur', 'uploads/clients/client00204.jpg', '0.00', '0', '2026-01-27 18:16:29', '');
INSERT INTO `client_list` VALUES ('205', 'Ajay', 'Chourasiya', 'Gadarwara', '7415894299', 'roadshowdj25@gmail.com', 'Sainkheda', 'uploads/clients/client00205.jpg', '0.00', '0', '2026-01-28 12:21:57', '');
INSERT INTO `client_list` VALUES ('206', 'Vikash', 'Mehra', 'Vidya production', '8462825010', '', 'Vidya production, jabalpur', '', '0.00', '0', '2026-01-29 17:26:01', '');
INSERT INTO `client_list` VALUES ('207', 'Akshay', 'Kushwala', 'Mahakal Mandla', '7898613666', '', 'Mahakal Tent, Mandla', 'uploads/clients/client00207.jpg', '0.00', '0', '2026-01-30 12:46:06', '');
INSERT INTO `client_list` VALUES ('208', 'Golu', 'Gupta', 'DJ Saasbahu', '9340480626', '', 'sasbahu, kareli, barman', '', '0.00', '0', '2026-01-31 12:35:40', '');
INSERT INTO `client_list` VALUES ('209', 'Satish', 'Rajput', 'Kareli', '6260779275', '', 'Kareli', '', '0.00', '0', '2026-01-31 12:56:14', '');
INSERT INTO `client_list` VALUES ('210', 'santosh', 'sahu', 'om mobile barela', '9424395396', '', 'Barela', '', '0.00', '0', '2026-01-31 13:07:09', '');
INSERT INTO `client_list` VALUES ('211', 'Ayush', 'Sahu', 'Panagar', '6260955906', '', 'Ayush light, panagar', '', '0.00', '0', '2026-01-31 14:37:25', '');
INSERT INTO `client_list` VALUES ('212', 'Sanjay', 'Patel', 'Byohari', '9752990613', 'sanjaykumarpatel613@gmail.com', 'Byohari', 'uploads/clients/client00212.jpg', '0.00', '0', '2026-01-31 15:09:57', '');
INSERT INTO `client_list` VALUES ('213', 'Mudit', 'Gupta', 'Shahpura', '7770823660', '', 'Baba shyam dj, maa narmda event, shahpura', 'uploads/clients/client00213.jpg', '0.00', '0', '2026-02-01 12:23:29', '');
INSERT INTO `client_list` VALUES ('214', 'santosh', 'thakur', 'seoni', '9630707017', '', 'Smart DJ, seoni', 'uploads/clients/client00214.jpg', '0.00', '0', '2026-02-01 12:51:59', '');
INSERT INTO `client_list` VALUES ('215', 'Jugal', 'Kishor rajak ', '(khusbhoo mo.) Ghanshor ', '6261152384', '', '(khusbho mo.) Ghanshor ', 'uploads/clients/client00215.jpg', '0.00', '0', '2026-02-01 13:56:42', '');
INSERT INTO `client_list` VALUES ('216', 'Rahul ', 'thakur ', 'adhartal', '8817924253', '', '', '', '0.00', '0', '2026-02-02 15:05:55', '');

DROP TABLE IF EXISTS `client_payments`;
CREATE TABLE `client_payments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `job_id` varchar(50) DEFAULT NULL,
  `bill_no` varchar(50) DEFAULT NULL,
  `payment_date` date DEFAULT curdate(),
  `amount` decimal(10,2) NOT NULL,
  `discount` decimal(10,2) DEFAULT 0.00,
  `net_amount` decimal(10,2) GENERATED ALWAYS AS (`amount` - `discount`) STORED,
  `payment_mode` enum('Cash','UPI','NEFT','Cheque','Bank Transfer','PhonePe/GPay') DEFAULT 'Cash',
  `payment_type` enum('Full','Partial','Advance','On Account') DEFAULT 'Full',
  `remarks` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `client_id` (`client_id`),
  KEY `idx_client_id` (`client_id`),
  CONSTRAINT `client_payments_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `client_list` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=185 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `client_payments` VALUES ('19', '41', '', '', '2025-12-06', '1500.00', '0.00', '1500.00', 'Cash', 'Full', 'today adjusted', '2025-12-06 11:31:11');
INSERT INTO `client_payments` VALUES ('20', '66', '', '', '2025-12-06', '500.00', '0.00', '500.00', 'Cash', 'Full', '', '2025-12-06 12:14:32');
INSERT INTO `client_payments` VALUES ('21', '38', '', '', '2025-12-06', '4000.00', '0.00', '4000.00', 'Cash', 'Full', 'adjusted', '2025-12-06 12:34:33');
INSERT INTO `client_payments` VALUES ('22', '97', '', '', '2025-12-06', '4500.00', '0.00', '4500.00', 'Cash', 'Full', '', '2025-12-06 12:37:33');
INSERT INTO `client_payments` VALUES ('23', '9', '27267', '', '2025-12-06', '2200.00', '300.00', '1900.00', 'Cash', 'Full', '', '2025-12-06 18:22:28');
INSERT INTO `client_payments` VALUES ('25', '33', '27571', '', '2025-12-06', '1500.00', '100.00', '1400.00', 'Cash', 'Full', '', '2025-12-06 20:24:28');
INSERT INTO `client_payments` VALUES ('26', '33', '', '', '2025-12-06', '300.00', '0.00', '300.00', 'Cash', 'Full', '', '2025-12-06 20:25:08');
INSERT INTO `client_payments` VALUES ('27', '26', '', '', '2025-12-06', '500.00', '0.00', '500.00', 'Cash', 'Full', '', '2025-12-06 20:47:58');
INSERT INTO `client_payments` VALUES ('28', '63', '', '', '2025-12-06', '2500.00', '0.00', '2500.00', 'Cash', 'Full', '', '2025-12-06 20:48:54');
INSERT INTO `client_payments` VALUES ('30', '115', '', '', '2025-12-07', '200.00', '0.00', '200.00', 'Cash', 'Full', '', '2025-12-07 16:31:59');
INSERT INTO `client_payments` VALUES ('32', '113', '', '', '2025-12-07', '300.00', '50.00', '250.00', 'Cash', 'Full', '', '2025-12-07 18:58:38');
INSERT INTO `client_payments` VALUES ('39', '8', '', '', '2025-12-08', '4450.00', '0.00', '4450.00', 'Cash', 'Full', '', '2025-12-08 13:30:26');
INSERT INTO `client_payments` VALUES ('40', '118', '', '', '2025-12-09', '300.00', '0.00', '300.00', 'UPI', 'Full', '', '2025-12-09 18:40:17');
INSERT INTO `client_payments` VALUES ('44', '120', '', '', '2025-12-10', '800.00', '0.00', '800.00', 'Cash', 'Full', '', '2025-12-10 17:14:38');
INSERT INTO `client_payments` VALUES ('45', '121', '', '', '2025-12-10', '700.00', '0.00', '700.00', 'Cash', 'Full', '', '2025-12-10 17:15:46');
INSERT INTO `client_payments` VALUES ('46', '19', '', '', '2025-12-11', '11650.00', '0.00', '11650.00', 'Cash', 'Full', 'amount adjusted till 11/12/25', '2025-12-11 13:01:34');
INSERT INTO `client_payments` VALUES ('47', '17', '', '', '2025-12-11', '6000.00', '0.00', '6000.00', 'Cash', 'Full', 'amount adjusted till 11/12/25', '2025-12-11 13:04:02');
INSERT INTO `client_payments` VALUES ('48', '46', '', '', '2025-12-11', '11050.00', '0.00', '11050.00', 'Cash', 'Full', 'amount adjusted till 11/12/25', '2025-12-11 13:06:44');
INSERT INTO `client_payments` VALUES ('49', '73', '', '', '2025-12-11', '4350.00', '0.00', '4350.00', 'Cash', 'Full', 'amount adjusted till 11/12/25', '2025-12-11 13:11:21');
INSERT INTO `client_payments` VALUES ('50', '18', '', '', '2025-12-11', '7200.00', '0.00', '7200.00', 'Cash', 'Full', 'amount adjusted till 11/12/25', '2025-12-11 13:12:55');
INSERT INTO `client_payments` VALUES ('51', '42', '', '', '2025-12-11', '6070.00', '0.00', '6070.00', 'Cash', 'Full', 'amount adjusted till 11/12/25', '2025-12-11 13:13:47');
INSERT INTO `client_payments` VALUES ('52', '10', '', '', '2025-12-11', '5900.00', '0.00', '5900.00', 'Cash', 'Full', 'amount adjusted till 11/12/25', '2025-12-11 13:14:20');
INSERT INTO `client_payments` VALUES ('53', '101', '', '', '2025-12-11', '1200.00', '0.00', '1200.00', 'Cash', 'Full', '', '2025-12-11 19:42:52');
INSERT INTO `client_payments` VALUES ('54', '19', '', '', '2025-12-12', '1400.00', '0.00', '1400.00', 'Cash', 'Partial', '', '2025-12-12 13:18:42');
INSERT INTO `client_payments` VALUES ('55', '19', '', '', '2025-12-12', '800.00', '0.00', '800.00', 'UPI', 'Full', '', '2025-12-12 13:19:00');
INSERT INTO `client_payments` VALUES ('56', '130', '27595', '', '2025-12-12', '600.00', '0.00', '600.00', 'UPI', 'Full', '', '2025-12-12 18:12:04');
INSERT INTO `client_payments` VALUES ('57', '118', '', '', '2025-12-12', '900.00', '0.00', '900.00', 'UPI', 'Full', '', '2025-12-12 19:31:54');
INSERT INTO `client_payments` VALUES ('60', '16', '', '', '2025-12-12', '500.00', '400.00', '100.00', 'Cash', 'Full', '', '2025-12-12 20:52:51');
INSERT INTO `client_payments` VALUES ('61', '22', '', '', '2025-12-14', '3100.00', '0.00', '3100.00', 'Cash', 'Full', 'Adjustment', '2025-12-14 01:01:04');
INSERT INTO `client_payments` VALUES ('62', '133', '', '', '2025-12-14', '1500.00', '0.00', '1500.00', 'Cash', 'Full', '', '2025-12-14 12:03:55');
INSERT INTO `client_payments` VALUES ('65', '60', '', '', '2025-12-14', '3800.00', '0.00', '3800.00', 'Cash', 'Full', '', '2025-12-14 12:42:16');
INSERT INTO `client_payments` VALUES ('66', '58', '', '', '2025-12-14', '2000.00', '0.00', '2000.00', 'Cash', 'Full', '', '2025-12-14 12:42:34');
INSERT INTO `client_payments` VALUES ('67', '119', '', '', '2025-12-14', '300.00', '0.00', '300.00', 'UPI', 'Full', '', '2025-12-14 20:43:52');
INSERT INTO `client_payments` VALUES ('68', '75', '', '', '2025-12-14', '13800.00', '0.00', '13800.00', 'Cash', 'Full', '', '2025-12-14 20:44:49');
INSERT INTO `client_payments` VALUES ('69', '33', '', '', '2025-12-14', '900.00', '0.00', '900.00', 'Cash', 'Full', '', '2025-12-14 20:46:36');
INSERT INTO `client_payments` VALUES ('71', '119', '', '', '2025-12-16', '2500.00', '250.00', '2250.00', 'UPI', 'Full', '', '2025-12-16 16:45:27');
INSERT INTO `client_payments` VALUES ('72', '94', '27522', '', '2025-12-17', '900.00', '0.00', '900.00', 'UPI', 'Full', '', '2025-12-17 18:15:26');
INSERT INTO `client_payments` VALUES ('73', '137', '', '', '2025-12-17', '400.00', '0.00', '400.00', 'Cash', 'Full', '', '2025-12-17 19:32:36');
INSERT INTO `client_payments` VALUES ('74', '19', '', '', '2025-12-18', '5000.00', '0.00', '5000.00', 'Cash', 'Partial', '4 SHARPY SAIF TOTAL BILL6400', '2025-12-18 17:29:57');
INSERT INTO `client_payments` VALUES ('75', '109', '', '', '2025-12-19', '500.00', '0.00', '500.00', 'Cash', '', '', '2025-12-19 13:36:24');
INSERT INTO `client_payments` VALUES ('76', '135', '', '', '2025-12-19', '800.00', '0.00', '800.00', 'Cash', 'Full', '', '2025-12-19 16:17:46');
INSERT INTO `client_payments` VALUES ('77', '138', '', '', '2025-12-19', '750.00', '0.00', '750.00', '', '', '', '2025-12-19 16:34:42');
INSERT INTO `client_payments` VALUES ('78', '141', '', '', '2025-12-20', '200.00', '0.00', '200.00', 'Cash', '', '', '2025-12-20 18:10:53');
INSERT INTO `client_payments` VALUES ('79', '140', '', '', '2025-12-21', '850.00', '0.00', '850.00', '', '', 'for sharpy 	27634', '2025-12-21 18:03:53');
INSERT INTO `client_payments` VALUES ('80', '20', '', '', '2025-12-21', '5250.00', '0.00', '5250.00', 'Cash', '', 'adjustment', '2025-12-21 18:47:12');
INSERT INTO `client_payments` VALUES ('81', '20', '', '', '2025-12-21', '3000.00', '0.00', '3000.00', 'Cash', '', '27635, 27636', '2025-12-21 20:06:23');
INSERT INTO `client_payments` VALUES ('82', '144', '', '', '2025-12-24', '8500.00', '500.00', '8000.00', 'Cash', '', 'none', '2025-12-24 20:28:54');
INSERT INTO `client_payments` VALUES ('83', '146', '', '', '2025-12-24', '400.00', '0.00', '400.00', 'Cash', '', '', '2025-12-24 21:35:52');
INSERT INTO `client_payments` VALUES ('84', '40', '', '', '2025-12-26', '4500.00', '0.00', '4500.00', 'Cash', 'Full', '2000 pahle de gaye the 2500 aaj diye', '2025-12-26 19:45:34');
INSERT INTO `client_payments` VALUES ('85', '149', '', '', '2025-12-26', '5000.00', '0.00', '5000.00', '', '', 'baki kal denge', '2025-12-26 19:51:18');
INSERT INTO `client_payments` VALUES ('86', '154', '', '', '2025-12-28', '500.00', '0.00', '500.00', 'Cash', '', '', '2025-12-28 13:15:04');
INSERT INTO `client_payments` VALUES ('87', '155', '', '', '2025-12-28', '500.00', '0.00', '500.00', 'Cash', '', '', '2025-12-28 13:16:06');
INSERT INTO `client_payments` VALUES ('88', '156', '', '', '2025-12-28', '350.00', '0.00', '350.00', 'Cash', '', '', '2025-12-28 13:16:30');
INSERT INTO `client_payments` VALUES ('89', '129', '', '', '2025-12-28', '8000.00', '0.00', '8000.00', 'Cash', '', '', '2025-12-28 18:10:17');
INSERT INTO `client_payments` VALUES ('90', '93', '', '', '2025-12-28', '4500.00', '0.00', '4500.00', 'Cash', '', '', '2025-12-28 18:11:54');
INSERT INTO `client_payments` VALUES ('91', '64', '', '', '2025-12-28', '5500.00', '0.00', '5500.00', 'Cash', '', '', '2025-12-28 18:13:23');
INSERT INTO `client_payments` VALUES ('92', '6', '', '', '2025-12-29', '1500.00', '0.00', '1500.00', 'Cash', '', '', '2025-12-29 10:43:53');
INSERT INTO `client_payments` VALUES ('93', '158', '', '', '2025-12-29', '1500.00', '0.00', '1500.00', '', '', '', '2025-12-29 15:51:57');
INSERT INTO `client_payments` VALUES ('94', '6', '', '', '2025-12-29', '1400.00', '0.00', '1400.00', 'Cash', '', '', '2025-12-29 16:01:53');
INSERT INTO `client_payments` VALUES ('95', '109', '', '', '2025-12-29', '1000.00', '0.00', '1000.00', 'Cash', '', '', '2025-12-29 21:12:36');
INSERT INTO `client_payments` VALUES ('96', '5', '', '', '2025-12-30', '3000.00', '0.00', '3000.00', '', '', '', '2025-12-30 14:11:53');
INSERT INTO `client_payments` VALUES ('97', '5', '', '', '2025-12-30', '1500.00', '0.00', '1500.00', 'Cash', '', '', '2025-12-30 14:12:14');
INSERT INTO `client_payments` VALUES ('98', '30', '27326', '', '2025-12-30', '2000.00', '0.00', '2000.00', 'UPI', 'Full', 'phonepe', '2025-12-30 17:00:53');
INSERT INTO `client_payments` VALUES ('99', '85', '', '', '2025-12-30', '5500.00', '0.00', '5500.00', 'Cash', '', '', '2025-12-30 18:06:31');
INSERT INTO `client_payments` VALUES ('100', '65', '', '', '2025-12-30', '2000.00', '0.00', '2000.00', 'PhonePe/GPay', 'Full', '', '2025-12-30 18:41:54');
INSERT INTO `client_payments` VALUES ('102', '85', '', '', '2025-12-30', '1500.00', '0.00', '1500.00', '', '', '', '2025-12-30 19:44:22');
INSERT INTO `client_payments` VALUES ('109', '36', '', '', '2025-11-02', '4500.00', '0.00', '4500.00', 'Cash', '', '', '2026-01-01 13:52:21');
INSERT INTO `client_payments` VALUES ('110', '143', '', '', '2025-12-23', '3500.00', '0.00', '3500.00', 'Cash', '', '', '2026-01-01 13:55:22');
INSERT INTO `client_payments` VALUES ('111', '91', '', '', '2026-01-01', '2000.00', '1000.00', '1000.00', 'UPI', 'Full', 'for 27518, 27517', '2026-01-01 14:01:18');
INSERT INTO `client_payments` VALUES ('112', '14', '27289', '', '2025-10-27', '5000.00', '0.00', '5000.00', '', 'Full', '', '2026-01-01 14:20:21');
INSERT INTO `client_payments` VALUES ('113', '162', '27718', '', '2025-12-31', '2800.00', '0.00', '2800.00', 'Cash', 'Full', '', '2026-01-01 16:24:30');
INSERT INTO `client_payments` VALUES ('114', '66', '', '', '2026-01-02', '5000.00', '300.00', '4700.00', 'Cash', 'Full', '', '2026-01-02 17:05:49');
INSERT INTO `client_payments` VALUES ('115', '164', '27721', '', '2026-01-05', '500.00', '0.00', '500.00', 'Cash', 'Full', '', '2026-01-05 19:38:55');
INSERT INTO `client_payments` VALUES ('116', '167', '27xxx', '', '2026-01-07', '2800.00', '200.00', '2600.00', 'Cash', 'Full', 'for 27724, 27725', '2026-01-07 15:26:05');
INSERT INTO `client_payments` VALUES ('117', '171', '', '474', '2026-01-07', '1500.00', '0.00', '1500.00', 'Cash', 'Full', 'By pradeep', '2026-01-07 22:05:00');
INSERT INTO `client_payments` VALUES ('118', '170', '', '', '2026-01-07', '800.00', '0.00', '800.00', 'Cash', 'Full', '', '2026-01-07 22:08:56');
INSERT INTO `client_payments` VALUES ('119', '171', '', '475', '2026-01-07', '11500.00', '0.00', '11500.00', 'PhonePe/GPay', 'Full', '', '2026-01-08 13:11:39');
INSERT INTO `client_payments` VALUES ('120', '177', '', '', '2026-01-10', '1200.00', '0.00', '1200.00', 'Cash', 'Full', '', '2026-01-11 15:13:14');
INSERT INTO `client_payments` VALUES ('121', '180', '27767', '', '2026-01-11', '500.00', '0.00', '500.00', 'Cash', 'Full', '', '2026-01-11 19:09:41');
INSERT INTO `client_payments` VALUES ('122', '107', '26704', '', '2026-01-12', '7000.00', '0.00', '7000.00', 'Cash', 'Partial', '1500 baki', '2026-01-12 13:14:06');
INSERT INTO `client_payments` VALUES ('123', '107', '27550', '', '2025-12-03', '300.00', '0.00', '300.00', 'PhonePe/GPay', 'Full', '', '2026-01-12 13:16:34');
INSERT INTO `client_payments` VALUES ('124', '181', '', '', '2026-01-13', '1000.00', '0.00', '1000.00', 'PhonePe/GPay', 'Full', '', '2026-01-13 12:28:32');
INSERT INTO `client_payments` VALUES ('125', '151', '', '', '2026-01-13', '500.00', '0.00', '500.00', 'Cash', 'Full', '', '2026-01-13 17:17:22');
INSERT INTO `client_payments` VALUES ('126', '183', '', '', '2026-01-13', '1500.00', '0.00', '1500.00', 'Cash', 'Full', '', '2026-01-13 20:10:28');
INSERT INTO `client_payments` VALUES ('127', '168', '', '', '2026-01-13', '10000.00', '0.00', '10000.00', 'PhonePe/GPay', 'Full', '', '2026-01-13 20:26:53');
INSERT INTO `client_payments` VALUES ('128', '182', '', '', '2026-01-13', '250.00', '0.00', '250.00', 'Cash', 'Full', 'hemant collected', '2026-01-13 20:34:29');
INSERT INTO `client_payments` VALUES ('129', '107', '27735', '', '2026-01-14', '1700.00', '0.00', '1700.00', 'Cash', 'Full', '', '2026-01-14 15:21:26');
INSERT INTO `client_payments` VALUES ('130', '186', '', '', '2026-01-14', '55000.00', '0.00', '55000.00', 'Cash', 'Full', '', '2026-01-14 18:26:51');
INSERT INTO `client_payments` VALUES ('131', '184', '27781', '', '2026-01-14', '4700.00', '0.00', '4700.00', 'PhonePe/GPay', 'Full', 'new korad dc 3005 ds', '2026-01-14 20:04:29');
INSERT INTO `client_payments` VALUES ('132', '187', '', '', '2026-01-14', '1000.00', '500.00', '500.00', 'Cash', 'Full', '', '2026-01-14 21:34:58');
INSERT INTO `client_payments` VALUES ('133', '188', '27820', '', '2026-01-17', '1500.00', '500.00', '1000.00', 'PhonePe/GPay', 'Full', '', '2026-01-17 17:26:44');
INSERT INTO `client_payments` VALUES ('134', '19', '', '', '2026-01-18', '14000.00', '0.00', '14000.00', 'Cash', 'Full', '', '2026-01-18 14:31:52');
INSERT INTO `client_payments` VALUES ('135', '169', '', '', '2026-01-18', '350.00', '0.00', '350.00', 'Cash', 'Full', '', '2026-01-18 19:04:34');
INSERT INTO `client_payments` VALUES ('136', '190', '', '', '2026-01-18', '500.00', '0.00', '500.00', 'Cash', 'Full', '', '2026-01-19 11:22:09');
INSERT INTO `client_payments` VALUES ('137', '191', '27832', '', '2026-01-19', '350.00', '0.00', '350.00', 'Cash', 'Full', '', '2026-01-19 13:19:58');
INSERT INTO `client_payments` VALUES ('138', '65', '', '', '2025-12-04', '900.00', '0.00', '900.00', 'Cash', 'Full', '', '2026-01-19 16:02:46');
INSERT INTO `client_payments` VALUES ('139', '51', '', '', '2026-01-20', '1450.00', '0.00', '1450.00', 'Cash', 'Full', '1000 pahle de gaye the ', '2026-01-20 14:16:12');
INSERT INTO `client_payments` VALUES ('140', '119', '', '', '2026-01-20', '500.00', '300.00', '200.00', 'Cash', 'Full', '', '2026-01-20 15:22:02');
INSERT INTO `client_payments` VALUES ('141', '43', '', '', '2025-11-07', '1900.00', '0.00', '1900.00', 'Cash', 'Full', '', '2026-01-20 15:25:32');
INSERT INTO `client_payments` VALUES ('142', '17', '', '', '2026-01-21', '3000.00', '600.00', '2400.00', 'Cash', 'Full', '', '2026-01-21 16:16:45');
INSERT INTO `client_payments` VALUES ('143', '68', '', '', '2026-01-21', '800.00', '0.00', '800.00', 'PhonePe/GPay', 'Full', '', '2026-01-21 17:44:13');
INSERT INTO `client_payments` VALUES ('144', '168', '', '', '2026-01-21', '1600.00', '0.00', '1600.00', 'PhonePe/GPay', 'Full', '', '2026-01-21 18:43:32');
INSERT INTO `client_payments` VALUES ('145', '68', '', '', '2025-11-21', '900.00', '0.00', '900.00', 'Cash', 'Full', '', '2026-01-21 18:46:02');
INSERT INTO `client_payments` VALUES ('146', '171', '', '', '2026-01-22', '6500.00', '0.00', '6500.00', 'PhonePe/GPay', 'Full', '', '2026-01-22 18:43:15');
INSERT INTO `client_payments` VALUES ('147', '199', '', '', '2026-01-22', '1200.00', '300.00', '900.00', 'Cash', 'Full', '', '2026-01-22 19:00:58');
INSERT INTO `client_payments` VALUES ('148', '88', '', '', '2025-11-24', '3000.00', '0.00', '3000.00', 'Cash', 'Full', '', '2026-01-23 18:05:05');
INSERT INTO `client_payments` VALUES ('149', '134', '', '', '2026-01-23', '450.00', '0.00', '450.00', 'Cash', 'Full', '', '2026-01-23 18:40:25');
INSERT INTO `client_payments` VALUES ('150', '17', '', '', '2026-01-23', '900.00', '0.00', '900.00', 'PhonePe/GPay', 'Full', '', '2026-01-23 19:41:01');
INSERT INTO `client_payments` VALUES ('151', '198', '', '', '2026-01-24', '1500.00', '0.00', '1500.00', 'Cash', 'Full', '', '2026-01-24 20:13:03');
INSERT INTO `client_payments` VALUES ('152', '200', '', '', '2026-01-24', '300.00', '0.00', '300.00', 'Cash', 'Full', '', '2026-01-25 00:21:29');
INSERT INTO `client_payments` VALUES ('153', '88', '', '', '2026-01-25', '4400.00', '100.00', '4300.00', 'Cash', 'Full', '', '2026-01-25 12:45:42');
INSERT INTO `client_payments` VALUES ('154', '19', '', '', '2026-01-26', '5000.00', '0.00', '5000.00', 'Cash', 'Partial', '', '2026-01-26 14:23:29');
INSERT INTO `client_payments` VALUES ('155', '149', '', '', '2026-01-04', '1000.00', '2500.00', '-1500.00', 'PhonePe/GPay', 'Full', '', '2026-01-26 14:35:00');
INSERT INTO `client_payments` VALUES ('156', '53', '', '', '2026-01-26', '900.00', '100.00', '800.00', 'Cash', 'Full', '', '2026-01-26 17:52:13');
INSERT INTO `client_payments` VALUES ('157', '202', '', '', '2026-01-26', '800.00', '0.00', '800.00', 'Cash', 'Full', '', '2026-01-26 18:36:38');
INSERT INTO `client_payments` VALUES ('158', '122', '', '', '2025-12-10', '1500.00', '0.00', '1500.00', 'Cash', 'Full', '', '2026-01-26 18:41:59');
INSERT INTO `client_payments` VALUES ('159', '201', '', '', '2026-01-26', '1500.00', '500.00', '1000.00', 'Cash', 'Full', '', '2026-01-26 19:34:26');
INSERT INTO `client_payments` VALUES ('160', '53', '', '', '2025-11-11', '1000.00', '0.00', '1000.00', 'Cash', 'Full', '', '2026-01-26 19:36:49');
INSERT INTO `client_payments` VALUES ('161', '204', '', '', '2026-01-27', '500.00', '0.00', '500.00', 'PhonePe/GPay', 'Full', '', '2026-01-27 19:51:05');
INSERT INTO `client_payments` VALUES ('162', '101', '', '', '2026-01-27', '1500.00', '400.00', '1100.00', 'Cash', 'Full', '', '2026-01-27 20:31:53');
INSERT INTO `client_payments` VALUES ('163', '205', '', '', '2026-01-28', '1500.00', '0.00', '1500.00', 'PhonePe/GPay', 'Full', '', '2026-01-28 13:21:37');
INSERT INTO `client_payments` VALUES ('164', '109', '', '', '2026-01-28', '1500.00', '0.00', '1500.00', 'Cash', 'Full', '', '2026-01-28 17:03:23');
INSERT INTO `client_payments` VALUES ('165', '46', '', '', '2026-01-29', '4000.00', '1250.00', '2750.00', 'Cash', 'Full', '1250 adjusted', '2026-01-29 11:42:28');
INSERT INTO `client_payments` VALUES ('166', '64', '', '', '2026-01-28', '4500.00', '0.00', '4500.00', 'Cash', 'Full', '', '2026-01-29 11:43:18');
INSERT INTO `client_payments` VALUES ('167', '122', '', '', '2026-01-27', '1500.00', '100.00', '1400.00', 'PhonePe/GPay', 'Full', '', '2026-01-29 12:06:39');
INSERT INTO `client_payments` VALUES ('168', '203', '', '', '2026-01-28', '15000.00', '1000.00', '14000.00', 'PhonePe/GPay', 'Full', '10000(phonepe), 5000(GpeyBiz)', '2026-01-29 12:15:25');
INSERT INTO `client_payments` VALUES ('169', '34', '', '', '2025-11-02', '1500.00', '300.00', '1200.00', 'Cash', 'Full', '', '2026-01-29 12:56:23');
INSERT INTO `client_payments` VALUES ('170', '153', '', '', '2026-01-29', '7500.00', '550.00', '6950.00', 'Cash', 'Full', '', '2026-01-29 17:57:30');
INSERT INTO `client_payments` VALUES ('172', '149', '', '', '2026-01-30', '400.00', '0.00', '400.00', 'Cash', 'Full', '', '2026-01-30 16:43:18');
INSERT INTO `client_payments` VALUES ('173', '18', '', '', '2026-01-30', '5000.00', '500.00', '4500.00', 'Cash', 'Full', '', '2026-01-30 17:18:02');
INSERT INTO `client_payments` VALUES ('174', '185', '', '', '2026-01-30', '14000.00', '0.00', '14000.00', 'Cash', 'Full', '21 par delivered', '2026-01-30 19:58:46');
INSERT INTO `client_payments` VALUES ('175', '208', '', '', '2025-04-17', '6500.00', '0.00', '6500.00', 'Cash', 'Partial', '', '2026-01-31 12:46:43');
INSERT INTO `client_payments` VALUES ('176', '171', '', '', '2026-01-31', '3000.00', '0.00', '3000.00', 'PhonePe/GPay', 'Full', '', '2026-01-31 15:54:27');
INSERT INTO `client_payments` VALUES ('177', '17', '', '', '2026-01-31', '500.00', '0.00', '500.00', 'Cash', 'Full', '', '2026-01-31 16:28:56');
INSERT INTO `client_payments` VALUES ('178', '206', '', '', '2026-01-31', '1100.00', '0.00', '1100.00', 'Cash', 'Full', '', '2026-01-31 16:41:47');
INSERT INTO `client_payments` VALUES ('179', '215', '', '', '2026-02-01', '400.00', '50.00', '350.00', 'Cash', 'Full', '', '2026-02-02 10:49:54');
INSERT INTO `client_payments` VALUES ('180', '214', '', '', '2026-02-01', '1500.00', '0.00', '1500.00', 'Cash', 'Full', '', '2026-02-02 10:50:33');
INSERT INTO `client_payments` VALUES ('181', '213', '', '', '2026-02-01', '500.00', '0.00', '500.00', 'Cash', 'Full', '', '2026-02-02 10:52:37');
INSERT INTO `client_payments` VALUES ('182', '122', '', '', '2026-02-01', '900.00', '600.00', '300.00', 'Cash', 'Full', 'stobe aur supplay repair 1500 advance tha', '2026-02-02 10:58:05');
INSERT INTO `client_payments` VALUES ('183', '205', '', '', '2026-02-02', '1800.00', '0.00', '1800.00', 'PhonePe/GPay', 'Full', 'INGITER 230W SALE', '2026-02-02 13:14:23');
INSERT INTO `client_payments` VALUES ('184', '211', '', '', '2026-02-02', '700.00', '0.00', '700.00', 'PhonePe/GPay', 'Full', '', '2026-02-02 19:33:24');

DROP TABLE IF EXISTS `direct_sale_items`;
CREATE TABLE `direct_sale_items` (
  `id` int(30) NOT NULL AUTO_INCREMENT,
  `sale_id` int(30) NOT NULL,
  `product_id` int(30) NOT NULL,
  `qty` int(11) NOT NULL,
  `price` decimal(15,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sale_id` (`sale_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `direct_sale_items_ibfk_1` FOREIGN KEY (`sale_id`) REFERENCES `direct_sales` (`id`) ON DELETE CASCADE,
  CONSTRAINT `direct_sale_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `product_list` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `direct_sale_items` VALUES ('14', '14', '8', '1', '3000.00');
INSERT INTO `direct_sale_items` VALUES ('17', '17', '6', '1', '1800.00');

DROP TABLE IF EXISTS `direct_sales`;
CREATE TABLE `direct_sales` (
  `id` int(30) NOT NULL AUTO_INCREMENT,
  `sale_code` varchar(100) NOT NULL,
  `client_id` int(30) DEFAULT NULL,
  `mechanic_id` int(11) DEFAULT NULL,
  `total_amount` decimal(15,2) NOT NULL,
  `payment_mode` varchar(50) NOT NULL,
  `remarks` text DEFAULT NULL,
  `date_created` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `sale_code` (`sale_code`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `direct_sales` VALUES ('14', 'DS-20260130-2239', '109', '1', '3000.00', 'Cash', '', '2026-01-30 15:29:00');
INSERT INTO `direct_sales` VALUES ('17', 'DS-20260202-9865', '205', '1', '1800.00', 'UPI', '', '2026-02-02 13:13:40');

DROP TABLE IF EXISTS `expense_list`;
CREATE TABLE `expense_list` (
  `id` int(30) NOT NULL AUTO_INCREMENT,
  `category` varchar(200) NOT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `remarks` text DEFAULT NULL,
  `date_created` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `expense_list` VALUES ('2', 'Shop Rent', '10000.00', 'boby bhaiya via imps from pnb biz', '2025-12-21 12:09:42');
INSERT INTO `expense_list` VALUES ('3', 'Others', '50.00', 'screw open to akbar', '2025-12-21 18:44:02');
INSERT INTO `expense_list` VALUES ('4', 'Others', '100.00', '180/450v condencer x 5
', '2025-12-23 20:33:11');
INSERT INTO `expense_list` VALUES ('5', 'Others', '800.00', 'Spare parts ', '2025-12-24 19:32:38');
INSERT INTO `expense_list` VALUES ('6', 'Others', '100.00', 'guard on demand', '2026-01-02 21:15:43');
INSERT INTO `expense_list` VALUES ('7', 'Others', '15.00', 'fader b100k', '2026-01-04 17:21:45');
INSERT INTO `expense_list` VALUES ('8', 'Electricity Bill', '950.00', 'ghar ka bill', '2026-01-05 20:43:20');
INSERT INTO `expense_list` VALUES ('9', 'Shop Rent', '9000.00', 'to bobby bhaiya via gpay', '2026-01-05 20:43:43');
INSERT INTO `expense_list` VALUES ('10', 'Spare Parts Purchase', '875.00', 'Quartz ,Componet ,Hc08x10,Hc165x20,SS34x100', '2026-01-06 15:52:39');
INSERT INTO `expense_list` VALUES ('11', 'Spare Parts Purchase', '10.00', '7805', '2026-01-07 13:48:26');
INSERT INTO `expense_list` VALUES ('12', 'Others', '500.00', 'OLD CHARGER', '2026-01-07 14:49:18');
INSERT INTO `expense_list` VALUES ('13', 'Others', '4280.00', 'car insurance nano to manoj sharma 9300112868', '2026-01-09 14:08:29');
INSERT INTO `expense_list` VALUES ('14', 'Spare Parts Purchase', '180.00', 'heating element folder machine', '2026-01-09 18:13:19');
INSERT INTO `expense_list` VALUES ('15', 'Spare Parts Purchase', '75.00', 'tda 2030, 6pin rc socket, b47kx3', '2026-01-11 15:07:52');
INSERT INTO `expense_list` VALUES ('16', 'Spare Parts Purchase', '10.00', 'silicon tape', '2026-01-12 19:14:40');
INSERT INTO `expense_list` VALUES ('17', 'Spare Parts Purchase', '15000.00', 'Sumit Kanojiya for delhi spare', '2026-01-13 20:05:10');
INSERT INTO `expense_list` VALUES ('18', 'Spare Parts Purchase', '10000.00', 'To divya jain sse sarkar machine display x4', '2026-01-13 20:05:55');
INSERT INTO `expense_list` VALUES ('19', 'Others', '1900.00', 'Traccon courier 38kg', '2026-01-13 20:37:19');
INSERT INTO `expense_list` VALUES ('20', 'Spare Parts Purchase', '4500.00', 'Korad DC Machine', '2026-01-14 18:28:30');
INSERT INTO `expense_list` VALUES ('21', 'Spare Parts Purchase', '95000.00', 'From Delhi Purchase to apna wala', '2026-01-14 21:39:49');
INSERT INTO `expense_list` VALUES ('22', 'Others', '360.00', '2x cutter 120 + 240', '2026-01-19 21:20:48');
INSERT INTO `expense_list` VALUES ('23', 'Others', '7855.00', 'credit card bill', '2026-01-20 11:23:48');
INSERT INTO `expense_list` VALUES ('24', 'Others', '240.00', 'chaiwale ko advance
', '2026-01-23 19:39:41');
INSERT INTO `expense_list` VALUES ('25', 'Spare Parts Purchase', '110.00', 'SCREW', '2026-01-31 15:30:36');

DROP TABLE IF EXISTS `inventory_list`;
CREATE TABLE `inventory_list` (
  `id` int(30) NOT NULL AUTO_INCREMENT,
  `product_id` int(30) NOT NULL,
  `quantity` int(30) NOT NULL DEFAULT 0,
  `place` text NOT NULL,
  `stock_date` date NOT NULL,
  `date_created` datetime NOT NULL DEFAULT current_timestamp(),
  `date_updated` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `product_id_fk_il` FOREIGN KEY (`product_id`) REFERENCES `product_list` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=60 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `inventory_list` VALUES ('12', '5', '9', '', '2025-10-21', '2025-10-21 21:49:10', '2025-10-23 01:40:17');
INSERT INTO `inventory_list` VALUES ('13', '14', '5', '', '2025-10-24', '2025-10-24 15:42:22', '2025-10-29 13:30:01');
INSERT INTO `inventory_list` VALUES ('14', '15', '1', '', '2025-10-27', '2025-10-27 21:17:06', '2025-10-27 21:17:20');
INSERT INTO `inventory_list` VALUES ('15', '16', '1', '', '2025-10-28', '2025-10-28 21:45:15', '2025-10-28 21:45:15');
INSERT INTO `inventory_list` VALUES ('16', '6', '1', '', '2025-10-29', '2025-10-29 19:08:09', '2025-10-29 19:08:09');
INSERT INTO `inventory_list` VALUES ('17', '17', '5', '', '2025-11-16', '2025-10-29 13:25:32', '2025-11-16 15:42:42');
INSERT INTO `inventory_list` VALUES ('18', '18', '5', '', '2025-11-16', '2025-10-29 13:28:34', '2025-11-16 15:45:48');
INSERT INTO `inventory_list` VALUES ('20', '19', '1', '', '2025-11-02', '2025-11-02 19:03:25', '2025-11-02 19:03:25');
INSERT INTO `inventory_list` VALUES ('21', '20', '3', '', '2025-11-02', '2025-11-02 21:23:07', '2025-11-02 21:23:07');
INSERT INTO `inventory_list` VALUES ('22', '21', '1', '', '2025-11-08', '2025-11-08 15:40:39', '2025-11-08 15:40:39');
INSERT INTO `inventory_list` VALUES ('23', '6', '1', '', '2025-11-08', '2025-11-08 15:41:06', '2025-11-08 15:41:06');
INSERT INTO `inventory_list` VALUES ('24', '6', '1', '', '2025-11-08', '2025-11-08 15:44:23', '2025-11-08 15:44:23');
INSERT INTO `inventory_list` VALUES ('25', '8', '1', '', '2025-11-09', '2025-11-09 15:38:54', '2025-11-09 15:38:54');
INSERT INTO `inventory_list` VALUES ('26', '6', '1', '', '2025-11-09', '2025-11-09 15:39:25', '2025-11-09 15:39:25');
INSERT INTO `inventory_list` VALUES ('27', '22', '1', '', '2025-11-09', '2025-11-09 15:42:15', '2025-11-09 15:42:15');
INSERT INTO `inventory_list` VALUES ('28', '23', '2', 'lkj', '2025-11-12', '2025-11-12 23:37:27', '2026-01-05 19:36:53');
INSERT INTO `inventory_list` VALUES ('29', '5', '10', '', '2025-11-13', '2025-11-14 03:39:52', '2025-11-14 03:39:52');
INSERT INTO `inventory_list` VALUES ('30', '10', '5', '', '2025-11-13', '2025-11-14 13:37:25', '2025-11-14 13:37:25');
INSERT INTO `inventory_list` VALUES ('31', '4', '3', '', '2025-11-16', '2025-11-16 14:53:10', '2026-01-01 17:22:26');
INSERT INTO `inventory_list` VALUES ('32', '15', '4', '', '2025-11-16', '2025-11-16 15:10:58', '2025-11-16 15:11:49');
INSERT INTO `inventory_list` VALUES ('33', '19', '2', '', '2025-11-16', '2025-11-16 15:24:09', '2025-11-16 15:24:09');
INSERT INTO `inventory_list` VALUES ('34', '12', '5', '', '2025-11-16', '2025-11-16 15:31:08', '2025-11-16 15:31:08');
INSERT INTO `inventory_list` VALUES ('36', '17', '3', '', '2025-11-16', '2025-11-16 19:39:31', '2025-11-16 19:39:31');
INSERT INTO `inventory_list` VALUES ('37', '24', '2', '', '2025-11-16', '2025-11-16 19:43:03', '2025-11-16 19:43:33');
INSERT INTO `inventory_list` VALUES ('38', '25', '2', '', '2025-11-16', '2025-11-16 19:43:17', '2025-11-16 19:43:17');
INSERT INTO `inventory_list` VALUES ('39', '26', '2', '', '2025-11-16', '2025-11-16 19:44:26', '2025-11-16 19:44:26');
INSERT INTO `inventory_list` VALUES ('40', '8', '1', '', '2025-11-21', '2025-11-21 14:55:21', '2025-11-21 14:55:21');
INSERT INTO `inventory_list` VALUES ('41', '21', '1', '', '2025-11-24', '2025-11-24 16:17:28', '2025-11-24 16:17:28');
INSERT INTO `inventory_list` VALUES ('42', '28', '5', '', '2025-12-04', '2025-12-04 18:14:06', '2025-12-04 18:14:06');
INSERT INTO `inventory_list` VALUES ('43', '16', '15', '', '2025-12-04', '2025-12-04 20:29:31', '2025-12-04 20:29:31');
INSERT INTO `inventory_list` VALUES ('44', '23', '10', '', '2025-12-11', '2025-12-11 19:46:17', '2025-12-11 19:46:17');
INSERT INTO `inventory_list` VALUES ('45', '29', '10', '', '2025-12-19', '2025-12-19 16:36:32', '2025-12-19 16:36:32');
INSERT INTO `inventory_list` VALUES ('46', '22', '20', '', '2025-12-19', '2025-12-19 16:40:04', '2025-12-19 16:41:26');
INSERT INTO `inventory_list` VALUES ('47', '30', '1', '', '2025-12-19', '2025-12-19 16:41:52', '2025-12-19 16:41:52');
INSERT INTO `inventory_list` VALUES ('48', '31', '1', '', '2025-12-19', '2025-12-19 16:46:01', '2025-12-19 16:46:01');
INSERT INTO `inventory_list` VALUES ('49', '32', '200', '', '2025-12-24', '2025-12-24 18:26:28', '2025-12-24 18:26:28');
INSERT INTO `inventory_list` VALUES ('50', '31', '1', '', '2025-12-24', '2025-12-24 21:37:14', '2025-12-24 21:37:14');
INSERT INTO `inventory_list` VALUES ('51', '33', '10', '', '2025-12-25', '2025-12-25 14:21:12', '2025-12-25 14:21:12');
INSERT INTO `inventory_list` VALUES ('52', '34', '5', '', '2025-12-27', '2025-12-27 13:31:51', '2025-12-27 13:31:51');
INSERT INTO `inventory_list` VALUES ('53', '27', '16', '', '2026-01-01', '2026-01-01 17:17:18', '2026-01-01 17:17:18');
INSERT INTO `inventory_list` VALUES ('54', '7', '6', '', '2026-01-01', '2026-01-01 17:20:56', '2026-01-01 17:21:09');
INSERT INTO `inventory_list` VALUES ('55', '10', '3', '', '2026-01-01', '2026-01-01 17:25:33', '2026-01-01 17:25:33');
INSERT INTO `inventory_list` VALUES ('56', '35', '2', '', '2026-01-01', '2026-01-01 18:24:55', '2026-01-01 18:24:55');
INSERT INTO `inventory_list` VALUES ('57', '6', '10', 'b2', '2026-01-05', '2026-01-05 16:00:53', '2026-01-05 17:29:33');
INSERT INTO `inventory_list` VALUES ('58', '23', '2', 'aaaa', '2026-01-05', '2026-01-05 16:13:58', '2026-01-05 16:13:58');
INSERT INTO `inventory_list` VALUES ('59', '39', '10', 'TTL1', '2026-01-26', '2026-01-26 15:18:21', '2026-01-26 15:18:21');

DROP TABLE IF EXISTS `job_id_counter`;
CREATE TABLE `job_id_counter` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `last_job_id` int(11) DEFAULT 27651,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `job_id_counter` VALUES ('1', '27916');

DROP TABLE IF EXISTS `lender_list`;
CREATE TABLE `lender_list` (
  `id` int(30) NOT NULL AUTO_INCREMENT,
  `fullname` varchar(250) NOT NULL,
  `contact` varchar(20) NOT NULL,
  `loan_amount` float NOT NULL DEFAULT 0,
  `interest_rate` float NOT NULL DEFAULT 0 COMMENT 'Percentage per annum',
  `tenure_months` int(11) NOT NULL DEFAULT 0,
  `reason` text DEFAULT NULL,
  `emi_amount` float NOT NULL DEFAULT 0,
  `start_date` date NOT NULL,
  `status` tinyint(1) NOT NULL DEFAULT 1 COMMENT '1=Active, 2=Completed',
  `date_created` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `lender_list` VALUES ('1', 'Preeti Vikram Jain', '9893036221', '250000', '12', '18', 'For Spare parches from delhi ', '15245.5', '2026-01-02', '1', '2026-01-02 12:31:22');
INSERT INTO `lender_list` VALUES ('2', 'Vik Canara bank', '9179105875', '94000', '10', '10', 'purchasing from delhi', '9836.2', '2026-01-11', '1', '2026-01-11 14:57:56');

DROP TABLE IF EXISTS `loan_payments`;
CREATE TABLE `loan_payments` (
  `id` int(30) NOT NULL AUTO_INCREMENT,
  `lender_id` int(30) NOT NULL,
  `amount_paid` float NOT NULL DEFAULT 0,
  `payment_date` date NOT NULL,
  `remarks` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `lender_id` (`lender_id`),
  CONSTRAINT `loan_payments_ibfk_1` FOREIGN KEY (`lender_id`) REFERENCES `lender_list` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `loan_payments` VALUES ('3', '1', '16000', '2026-01-31', 'to preeti account');
INSERT INTO `loan_payments` VALUES ('4', '2', '10000', '2026-01-31', 'to canara bank');

DROP TABLE IF EXISTS `mechanic_commission_history`;
CREATE TABLE `mechanic_commission_history` (
  `id` int(30) NOT NULL AUTO_INCREMENT,
  `mechanic_id` int(30) NOT NULL,
  `commission_percent` float(5,2) NOT NULL,
  `effective_date` date NOT NULL,
  `date_created` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `mechanic_commission_history` VALUES ('1', '1', '10.00', '2025-12-24', '2025-12-24 01:56:58');
INSERT INTO `mechanic_commission_history` VALUES ('2', '1', '0.00', '2025-12-24', '2025-12-24 12:26:36');
INSERT INTO `mechanic_commission_history` VALUES ('3', '1', '10.00', '2025-12-24', '2025-12-24 12:58:55');
INSERT INTO `mechanic_commission_history` VALUES ('4', '3', '0.00', '2025-12-24', '2025-12-24 22:42:05');
INSERT INTO `mechanic_commission_history` VALUES ('5', '2', '0.00', '2025-12-27', '2025-12-27 05:14:37');
INSERT INTO `mechanic_commission_history` VALUES ('6', '0', '0.00', '2026-01-04', '2026-01-04 16:53:55');
INSERT INTO `mechanic_commission_history` VALUES ('7', '3', '0.00', '2026-01-12', '2026-01-12 20:55:44');
INSERT INTO `mechanic_commission_history` VALUES ('8', '2', '0.00', '2026-01-13', '2026-01-13 12:10:04');
INSERT INTO `mechanic_commission_history` VALUES ('9', '3', '0.00', '2026-01-13', '2026-01-13 12:10:34');
INSERT INTO `mechanic_commission_history` VALUES ('10', '1', '10.00', '2026-01-13', '2026-01-13 12:10:48');

DROP TABLE IF EXISTS `mechanic_list`;
CREATE TABLE `mechanic_list` (
  `id` int(50) NOT NULL AUTO_INCREMENT,
  `firstname` varchar(250) NOT NULL,
  `middlename` text DEFAULT NULL,
  `lastname` varchar(250) NOT NULL,
  `contact` varchar(50) NOT NULL,
  `designation` varchar(100) DEFAULT 'Mechanic',
  `daily_salary` float(12,2) DEFAULT 0.00,
  `avatar` varchar(255) DEFAULT 'default-avatar.jpg',
  `commission_percent` float(5,2) DEFAULT 0.00,
  `status` tinyint(1) NOT NULL DEFAULT 1,
  `delete_flag` tinyint(1) NOT NULL DEFAULT 0,
  `date_added` datetime NOT NULL DEFAULT current_timestamp(),
  `date_updated` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `salary_per_day` decimal(10,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `mechanic_list` VALUES ('1', 'Vikram', '', 'Jain', '', 'Administrator', '600.00', 'avatar_1.png', '10.00', '1', '0', '2022-05-04 11:01:51', '2026-01-13 12:10:48', '500.00');
INSERT INTO `mechanic_list` VALUES ('2', 'Hemant', '', 'Mehra', '9111180559', 'Mechanic', '500.00', 'avatar_2.png', '0.00', '1', '0', '2022-05-04 11:02:00', '2026-01-13 12:10:04', '500.00');
INSERT INTO `mechanic_list` VALUES ('3', 'Preeti', 'Vikram', 'Jain', '9893036221', 'Supervisor', '450.00', 'avatar_3.png', '0.00', '1', '0', '2025-12-21 23:30:10', '2026-02-02 11:17:36', '500.00');
INSERT INTO `mechanic_list` VALUES ('4', 'Neelesh', 'Kumar', 'Janjewar', '6263171638', 'Supporter', '0.00', 'default-avatar.jpg', '0.00', '0', '0', '2026-01-04 16:53:55', '2026-01-05 13:25:54', '0.00');

DROP TABLE IF EXISTS `mechanic_salary_history`;
CREATE TABLE `mechanic_salary_history` (
  `id` int(30) NOT NULL AUTO_INCREMENT,
  `mechanic_id` int(30) NOT NULL,
  `salary` float(12,2) NOT NULL DEFAULT 0.00,
  `effective_date` date NOT NULL,
  `date_created` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `mechanic_id` (`mechanic_id`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `mechanic_salary_history` VALUES ('6', '2', '500.00', '2024-10-02', '2025-12-23 00:26:24');
INSERT INTO `mechanic_salary_history` VALUES ('12', '3', '400.00', '2025-12-24', '2025-12-24 22:42:05');
INSERT INTO `mechanic_salary_history` VALUES ('14', '1', '500.00', '2024-01-25', '2025-12-25 01:11:52');
INSERT INTO `mechanic_salary_history` VALUES ('15', '1', '600.00', '2026-01-01', '2025-12-25 01:12:07');
INSERT INTO `mechanic_salary_history` VALUES ('16', '2', '500.00', '2025-12-25', '2025-12-25 12:39:22');
INSERT INTO `mechanic_salary_history` VALUES ('17', '4', '0.00', '2026-01-04', '2026-01-04 16:53:55');
INSERT INTO `mechanic_salary_history` VALUES ('18', '3', '450.00', '2026-02-01', '2026-02-02 11:17:36');

DROP TABLE IF EXISTS `message_list`;
CREATE TABLE `message_list` (
  `id` int(30) NOT NULL AUTO_INCREMENT,
  `fullname` text NOT NULL,
  `contact` text NOT NULL,
  `email` text NOT NULL,
  `message` text NOT NULL,
  `status` tinyint(1) NOT NULL DEFAULT 0,
  `date_created` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `message_list` VALUES ('1', 'John Smith', '09123456789', 'jsmith@sample.com', 'This is a sample message only', '1', '2021-12-27 16:01:11');
INSERT INTO `message_list` VALUES ('2', 'Hemant mehra', 'Hemant mehra', 'Hemantmehra0316@gmail.com', 'Hello', '1', '2025-11-20 19:23:42');
INSERT INTO `message_list` VALUES ('3', 'Deepak sahu', '8982208191', 'ds9395351@gmail.com', 'Sir meri fog machine ka kya hua ', '1', '2025-11-21 13:10:35');
INSERT INTO `message_list` VALUES ('4', 'abhay rai', '8817121201', 'abhayrai227@gmail.com', 'sir mere gadi ke display ko dekh lo', '1', '2025-11-21 21:57:10');
INSERT INTO `message_list` VALUES ('5', 'Shushil Sahu Gudda', '9301200093', 'sainathgudda@gmail.com', 'Kya hal hai vikram bhai', '1', '2025-11-23 18:25:25');
INSERT INTO `message_list` VALUES ('6', 'Sumit kanojiya ', '9179999543', 'skanojiya33@yahoo.com', 'Sir laptop batao konsa lu', '1', '2025-11-23 19:51:51');
INSERT INTO `message_list` VALUES ('7', 'anurag pachori', '9200000030', 'carehitech99@gmail.com', 'vjvbvjkbmhvgcjkn /lknkj', '1', '2025-11-25 13:02:20');
INSERT INTO `message_list` VALUES ('8', 'Ashutosh Jain', '9893010431', 'code.asam@gmail.com', 'Manglam Electronics, meri dono smps jaldi kar de', '1', '2025-12-03 11:41:44');
INSERT INTO `message_list` VALUES ('9', 'Pradeep Singh Tomer', '9425160387', 'pradeepjbp.ups@gmail.com', 'Meri ups ki PCB ki ic badalna hai', '1', '2025-12-04 20:25:24');
INSERT INTO `message_list` VALUES ('10', 'dhjhgff', 'hhggg', 'customer1@gmail.com', 'cjchchcc', '1', '2025-12-07 13:33:00');
INSERT INTO `message_list` VALUES ('11', 'Deepak rajak ', 'Deepak rajak ', 'deepakrajak12@gmail.com', 'Igniter ic 12R
9131582254', '1', '2025-12-17 15:55:32');
INSERT INTO `message_list` VALUES ('12', 'DEEPAK RAJAK ', '9131852254', 'drajak288@gmail.com', 'Ignator ic ', '1', '2025-12-17 15:58:35');
INSERT INTO `message_list` VALUES ('13', 'Shailendra Balaiya', '9300122223', 'monubalaiya2222@gmail.com', 'sir meri mummy ka fm ka kya hua', '1', '2025-12-20 14:51:46');
INSERT INTO `message_list` VALUES ('14', 'Ashok Verma ', '9993088022', 'vermaashok591@gmail.com', 'Mere controller unit ', '0', '2026-01-21 20:44:33');
INSERT INTO `message_list` VALUES ('15', 'SANJAY BYOHARI', '9752990613', 'ASDASDSDASDDSD@BHH.COM', 'ASDASDSADSADSDSDADS', '0', '2026-01-31 15:22:32');

DROP TABLE IF EXISTS `product_list`;
CREATE TABLE `product_list` (
  `id` int(30) NOT NULL AUTO_INCREMENT,
  `name` text NOT NULL,
  `description` text NOT NULL,
  `cost_price` float(15,2) NOT NULL DEFAULT 0.00,
  `price` float(15,2) NOT NULL DEFAULT 0.00,
  `image_path` text NOT NULL,
  `status` tinyint(1) NOT NULL DEFAULT 1,
  `delete_flag` tinyint(1) NOT NULL DEFAULT 0,
  `date_created` datetime NOT NULL DEFAULT current_timestamp(),
  `date_updated` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=45 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `product_list` VALUES ('1', 'Par Led Bead GRB 3W', 'Par Led Bead GRB 3W', '0.00', '20.00', 'uploads/products/1.png', '1', '0', '2022-05-04 10:28:54', '2025-12-20 12:46:03');
INSERT INTO `product_list` VALUES ('2', 'Par Led Bead Green 3W', 'Par Led Bead Green 3W', '0.00', '20.00', 'uploads/products/2.png', '1', '0', '2022-05-04 10:29:20', '2025-12-20 12:46:39');
INSERT INTO `product_list` VALUES ('3', 'Par Led Bead Red 3W', 'Par Led Bead Red 3W', '0.00', '20.00', 'uploads/products/3.png', '1', '0', '2022-05-04 10:29:39', '2025-12-20 12:46:52');
INSERT INTO `product_list` VALUES ('4', 'Lamp 380w Osram stan', '380w lamp for stan monster king 600 and 650', '0.00', '5500.00', 'uploads/products/4.png', '1', '0', '2022-05-04 10:30:02', '2025-12-20 12:45:06');
INSERT INTO `product_list` VALUES ('5', 'Igniter 300w', 'for sharpy 7r ', '0.00', '2300.00', 'uploads/products/5.png', '1', '0', '2022-05-04 10:30:27', '2025-12-20 12:35:12');
INSERT INTO `product_list` VALUES ('6', 'Igniter 280w', 'for Sharpy 10r', '0.00', '2300.00', 'uploads/products/6.png', '1', '0', '2022-05-04 10:30:56', '2025-12-20 12:34:52');
INSERT INTO `product_list` VALUES ('7', 'lamp 230 w', 'good quality lamp for shapy 7r of all models', '0.00', '2300.00', 'uploads/products/7.png', '1', '0', '2022-05-04 10:31:15', '2025-12-20 12:43:49');
INSERT INTO `product_list` VALUES ('8', 'Lamp 300w Philips market', 'a good quality lamp which used in stan12r sharpy', '0.00', '3000.00', 'uploads/products/8.png', '1', '0', '2025-10-13 00:39:12', '2025-12-20 12:44:17');
INSERT INTO `product_list` VALUES ('9', 'Par Led Bead RGB 3W', 'Par Led Bead RGB 3W', '0.00', '20.00', 'uploads/products/9.png', '1', '0', '2025-10-13 09:48:55', '2025-12-20 12:47:07');
INSERT INTO `product_list` VALUES ('10', 'Lamp 300w Philips stan', 'original lamp 300w philips for stan12r', '0.00', '3500.00', 'uploads/products/10.png', '1', '0', '2025-10-13 09:51:02', '2025-12-20 12:44:35');
INSERT INTO `product_list` VALUES ('11', 'Par Led Bead Blue 3W', 'Par Led Bead Blue 3W', '0.00', '20.00', 'uploads/products/11.png', '1', '0', '2025-10-19 23:03:50', '2025-12-20 12:45:37');
INSERT INTO `product_list` VALUES ('12', 'Lamp 350w osram', '56mm big lamp for most 17r and 20r sharpy', '0.00', '3500.00', 'uploads/products/12.png', '1', '0', '2025-10-19 23:04:30', '2025-12-20 12:44:48');
INSERT INTO `product_list` VALUES ('13', 'ob2269 SMD', 'pwm ic smps', '0.00', '30.00', 'uploads/products/13.png', '1', '0', '2025-10-23 01:56:09', '2025-12-20 12:47:26');
INSERT INTO `product_list` VALUES ('14', 'Fog Pump 48W', 'Fog Pump 48W', '0.00', '1300.00', 'uploads/products/14.png', '1', '0', '2025-10-24 14:57:43', '2025-12-20 12:34:15');
INSERT INTO `product_list` VALUES ('15', 'Igniter 300w philips (Stan)', 'Igniter 300w philips (Stan)', '0.00', '3500.00', 'uploads/products/15.png', '1', '0', '2025-10-27 21:16:37', '2025-12-20 12:35:26');
INSERT INTO `product_list` VALUES ('16', '54 LED Plate 36v', '54 LED Plate 36v', '0.00', '550.00', 'uploads/products/16.png', '1', '0', '2025-10-28 21:44:22', '2025-12-20 12:33:46');
INSERT INTO `product_list` VALUES ('17', 'Thermostat long pin', 'Thermostat long pin', '0.00', '350.00', 'uploads/products/17.png', '1', '0', '2025-10-29 13:22:17', '2025-12-20 12:51:03');
INSERT INTO `product_list` VALUES ('18', 'Thermostat Short Pin', 'Thermostat Short Pin', '0.00', '350.00', 'uploads/products/18.png', '1', '0', '2025-10-29 13:27:29', '2025-12-20 12:51:18');
INSERT INTO `product_list` VALUES ('19', 'Sparkal heter supply', 'Sparkal heter supply', '0.00', '2500.00', 'uploads/products/19.png', '1', '0', '2025-11-02 19:02:05', '2025-12-20 12:50:29');
INSERT INTO `product_list` VALUES ('20', 'Q Fan 3core Stan', 'Q Fan 3core Stan', '0.00', '1500.00', 'uploads/products/20.png', '1', '0', '2025-11-02 21:22:15', '2025-12-20 12:49:42');
INSERT INTO `product_list` VALUES ('21', 'Lamp HiGlow', 'Lamp HiGlow', '0.00', '2300.00', 'uploads/products/21.png', '1', '0', '2025-11-08 15:39:33', '2025-12-20 12:45:21');
INSERT INTO `product_list` VALUES ('22', 'Encoder 5pin', 'Encoder for sharpy original', '0.00', '270.00', 'uploads/products/22.png', '1', '0', '2025-11-09 15:41:27', '2025-12-20 12:33:58');
INSERT INTO `product_list` VALUES ('23', '1602 Blueback Display', '1602 Blueback Display', '0.00', '450.00', 'uploads/products/23.png', '1', '0', '2025-11-12 23:36:50', '2025-12-16 12:02:24');
INSERT INTO `product_list` VALUES ('24', 'Igniter 350', 'Igniter 350', '0.00', '2700.00', 'uploads/products/24.png', '1', '0', '2025-11-16 19:41:13', '2025-12-18 11:58:25');
INSERT INTO `product_list` VALUES ('25', 'Igniter 380 Stan', 'Igniter 380 Stan', '0.00', '5500.00', 'uploads/products/25.png', '1', '0', '2025-11-16 19:41:57', '2025-12-20 12:42:16');
INSERT INTO `product_list` VALUES ('26', 'Sparkal Heater Induction', 'Sparkal Heater Induction', '0.00', '2500.00', 'uploads/products/26.png', '1', '0', '2025-11-16 19:42:46', '2025-12-20 12:54:26');
INSERT INTO `product_list` VALUES ('27', 'SMPS 36/12/380 400W SLIM', 'SMPS 36/12/380 400W SLIM', '0.00', '1600.00', 'uploads/products/27.png', '1', '0', '2025-11-17 12:12:34', '2025-12-20 12:50:46');
INSERT INTO `product_list` VALUES ('28', 'Fog Pump 31W', '31w pump for oil and liquid ', '0.00', '700.00', 'uploads/products/28.jpg', '1', '0', '2025-12-04 18:12:48', '2025-12-16 18:34:16');
INSERT INTO `product_list` VALUES ('29', '74HC14', ' It performs the logic INVERT (NOT) function, with six independent gates included in a single IC.', '0.00', '20.00', 'uploads/products/29.png', '1', '0', '2025-12-18 15:36:09', '2025-12-18 15:36:09');
INSERT INTO `product_list` VALUES ('30', '74HC4051', 'The 74HC4051 is an 8-channel analog multiplexer/demultiplexer integrated circuit, a versatile component used to route one of eight input signals to a single output or a single input to one of eight outputs using digital control signals.', '0.00', '40.00', 'uploads/products/30.png', '1', '0', '2025-12-18 15:38:50', '2025-12-18 15:38:50');
INSERT INTO `product_list` VALUES ('31', 'Encoder 3pin Big', 'Rotary Encoder 3 Pin ; Shape: Cylindrical ; Size: Shaft Length 20mm, Diameter 6mm ; Surface Finish: Nickel Plated ; Weight: 10 grams', '0.00', '250.00', 'uploads/products/31.png', '1', '0', '2025-12-19 16:45:48', '2025-12-19 16:45:48');
INSERT INTO `product_list` VALUES ('32', 'Fader b10k', 'Fader ', '0.00', '100.00', '', '1', '0', '2025-12-24 18:26:00', '2025-12-24 18:26:00');
INSERT INTO `product_list` VALUES ('33', 'SMD Coil', 'Smd Coil', '0.00', '200.00', '', '1', '0', '2025-12-25 14:20:56', '2025-12-25 14:20:56');
INSERT INTO `product_list` VALUES ('34', 'IB0505LS-1WR3', ' IB0505LS-1WR3 Stabilized Single output 5V to 5V 1W 200mA DC to DC Power module', '0.00', '550.00', 'uploads/products/34.png', '1', '0', '2025-12-27 13:31:15', '2025-12-27 13:31:15');
INSERT INTO `product_list` VALUES ('35', 'RGB Blinders Led 100w', 'RGB Blinders Led 100w', '0.00', '1200.00', 'uploads/products/35.jpg', '1', '0', '2026-01-01 18:24:23', '2026-01-01 18:24:23');
INSERT INTO `product_list` VALUES ('36', 'LM2596 DC-DC buck converter', 'This is an LM2596 DC-DC buck converter step-down power module with the high-precision potentiometer, capable of driving a load up to 3A with high efficiency.', '0.00', '100.00', 'uploads/products/36.png', '1', '0', '2026-01-01 19:52:35', '2026-01-01 19:52:35');
INSERT INTO `product_list` VALUES ('37', 'RF Remote Module', 'RF Remote Module', '0.00', '300.00', 'uploads/products/37.png', '1', '0', '2026-01-01 19:55:14', '2026-01-01 19:55:14');
INSERT INTO `product_list` VALUES ('38', 'LM7805', 'fixed-voltage integrated-circuit voltage regulators', '0.00', '20.00', '', '1', '0', '2026-01-06 16:14:07', '2026-01-06 16:14:07');
INSERT INTO `product_list` VALUES ('39', '74HC08', 'The 74HC08 is a high-speed CMOS logic integrated circuit (IC) that contains four independent quad 2-input AND gates. ', '0.00', '30.00', 'uploads/products/39.png', '1', '0', '2026-01-06 16:15:29', '2026-01-06 16:15:29');
INSERT INTO `product_list` VALUES ('40', 'ss34', 'schottkey diode', '0.00', '50.00', '', '1', '0', '2026-01-06 16:21:30', '2026-01-06 16:21:30');
INSERT INTO `product_list` VALUES ('41', 'Spare Part', 'general parts', '0.00', '100.00', '', '1', '0', '2026-01-11 15:10:11', '2026-01-11 15:10:11');
INSERT INTO `product_list` VALUES ('42', 'Fog Heater 3000w', 'Fog Heater 3000w', '0.00', '1700.00', '', '1', '0', '2026-01-18 19:23:13', '2026-01-18 19:23:13');

DROP TABLE IF EXISTS `service_list`;
CREATE TABLE `service_list` (
  `id` int(30) NOT NULL AUTO_INCREMENT,
  `name` text NOT NULL,
  `description` text NOT NULL,
  `price` float(15,2) NOT NULL DEFAULT 0.00,
  `status` tinyint(1) NOT NULL DEFAULT 1,
  `delete_flag` tinyint(1) NOT NULL DEFAULT 0,
  `date_created` datetime NOT NULL DEFAULT current_timestamp(),
  `date_updated` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `service_list` VALUES ('1', 'Service Charge 2000', 'Service Charge 2000', '2000.00', '1', '0', '2022-05-04 09:17:45', '2025-11-04 14:49:45');
INSERT INTO `service_list` VALUES ('2', 'Sharpy Repair', 'Smps repair, body repair included', '1500.00', '1', '0', '2022-05-04 09:18:06', '2025-10-20 23:17:12');
INSERT INTO `service_list` VALUES ('3', 'Sharpy Item Change', 'Any Item Replacement of sharpy', '500.00', '1', '0', '2022-05-04 09:19:01', '2025-10-20 23:21:48');
INSERT INTO `service_list` VALUES ('4', 'Sharpy Dmx repair', 'Dmx circuit Repair due to XLR Faulty', '850.00', '1', '0', '2022-05-04 09:19:36', '2025-10-20 23:19:55');
INSERT INTO `service_list` VALUES ('5', 'Sharpy Control Card Repir', 'Control Card repair, x of y or both, any motor ic or any sensor', '2000.00', '1', '0', '2022-05-04 09:20:33', '2025-10-20 23:18:50');
INSERT INTO `service_list` VALUES ('6', 'test', 'test', '1.00', '1', '1', '2022-05-04 09:20:49', '2022-05-04 09:20:57');
INSERT INTO `service_list` VALUES ('7', 'Smps repair (Sharpy) 450w', 'Smps repair (Sharpy)', '850.00', '1', '0', '2025-10-20 23:22:52', '2025-10-20 23:22:52');
INSERT INTO `service_list` VALUES ('8', 'Smps repair (Sharpy) 600w', 'Smps repair (Sharpy)', '1250.00', '1', '0', '2025-10-20 23:23:27', '2025-10-20 23:23:27');
INSERT INTO `service_list` VALUES ('9', 'Igniter Repair', 'Igniter Repair', '1000.00', '1', '0', '2025-10-20 23:24:20', '2025-10-20 23:24:20');
INSERT INTO `service_list` VALUES ('10', 'Sharpy test minimum charge ', 'Test only', '750.00', '1', '0', '2025-10-24 15:28:45', '2025-10-24 15:28:45');
INSERT INTO `service_list` VALUES ('11', 'Service Charge 200', 'Service Charge 200', '200.00', '1', '0', '2025-10-24 15:40:52', '2025-11-04 14:49:20');
INSERT INTO `service_list` VALUES ('12', 'Microwave PCB Repair', 'Microwave PCB Repair', '650.00', '1', '0', '2025-10-25 18:12:53', '2025-10-25 18:12:53');
INSERT INTO `service_list` VALUES ('13', 'Service Charge 600', 'Service Charge 600', '600.00', '1', '0', '2025-10-28 21:35:57', '2025-11-04 14:48:05');
INSERT INTO `service_list` VALUES ('14', 'Service Charge 250', 'Service Charge 250', '250.00', '1', '0', '2025-10-28 21:40:10', '2025-11-04 14:50:43');
INSERT INTO `service_list` VALUES ('15', 'Service Charge 300', 'Service Charge 300', '300.00', '1', '0', '2025-10-28 21:41:35', '2025-11-04 14:51:22');
INSERT INTO `service_list` VALUES ('16', 'Sparkal Machine Repair', 'Sparkal Machine Repair', '1500.00', '1', '0', '2025-10-28 23:47:27', '2025-10-28 23:47:27');
INSERT INTO `service_list` VALUES ('17', 'Mininum Charge 350', 'Mininum Charge 350', '350.00', '1', '0', '2025-10-28 23:52:47', '2025-10-28 23:52:47');
INSERT INTO `service_list` VALUES ('18', 'Service Charge 1500', 'Service Charge 1500', '1500.00', '1', '0', '2025-10-28 23:55:51', '2025-10-28 23:55:51');
INSERT INTO `service_list` VALUES ('19', 'Service Charge 700', 'Service Charge 700', '700.00', '1', '0', '2025-10-29 19:08:45', '2025-10-29 19:08:45');
INSERT INTO `service_list` VALUES ('20', 'Smd Repair 500', 'Smd Repair 500', '500.00', '1', '0', '2025-10-29 19:33:27', '2025-10-29 19:33:27');
INSERT INTO `service_list` VALUES ('21', 'Service Charge 500', 'Service Charge 500', '500.00', '1', '0', '2025-10-30 15:45:22', '2025-10-30 15:45:22');
INSERT INTO `service_list` VALUES ('22', 'Service charge 1000', 'Service charge 1000', '1000.00', '1', '0', '2025-11-02 19:04:56', '2025-11-02 19:04:56');
INSERT INTO `service_list` VALUES ('23', 'Discont -200', 'Discont -200', '-200.00', '1', '0', '2025-11-02 20:01:21', '2025-11-02 20:01:21');
INSERT INTO `service_list` VALUES ('24', 'Dmx Circuit 350', 'Dmx Circuit 350', '350.00', '1', '0', '2025-11-04 14:53:19', '2025-11-04 14:54:10');
INSERT INTO `service_list` VALUES ('25', '2500', '2500', '2500.00', '1', '0', '2025-12-03 11:27:13', '2025-12-03 11:27:13');

DROP TABLE IF EXISTS `system_info`;
CREATE TABLE `system_info` (
  `id` int(30) NOT NULL AUTO_INCREMENT,
  `meta_field` text NOT NULL,
  `meta_value` text NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `system_info` VALUES ('1', 'name', 'V-Technologies Repair Shop Management System');
INSERT INTO `system_info` VALUES ('6', 'short_name', 'V-Tech-RSMS - PHP');
INSERT INTO `system_info` VALUES ('11', 'logo', 'uploads/logo.png');
INSERT INTO `system_info` VALUES ('13', 'user_avatar', 'uploads/user_avatar.jpg');
INSERT INTO `system_info` VALUES ('14', 'cover', 'uploads/cover.png?v=1651626884');
INSERT INTO `system_info` VALUES ('15', 'email', 'vtech.jbp@gmail.com');
INSERT INTO `system_info` VALUES ('16', 'contact', '9179105875');
INSERT INTO `system_info` VALUES ('17', 'address', 'Vikram Jain, V-Technologies, F4 Hotel Plaza( Now Madhushala), Besides Jayanti Complex, Marhatal, Jabalpur, 482002');
INSERT INTO `system_info` VALUES ('18', 'license_status', 'inactive');

DROP TABLE IF EXISTS `transaction_images`;
CREATE TABLE `transaction_images` (
  `id` int(30) NOT NULL AUTO_INCREMENT,
  `transaction_id` int(30) NOT NULL,
  `image_path` varchar(255) NOT NULL,
  `date_created` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `transaction_id` (`transaction_id`),
  CONSTRAINT `fk_transaction_images` FOREIGN KEY (`transaction_id`) REFERENCES `transaction_list` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=64 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `transaction_images` VALUES ('26', '475', 'uploads/transactions/job_475_1766734536_0.jpg', '2025-12-26 13:05:36');
INSERT INTO `transaction_images` VALUES ('39', '543', 'uploads/transactions/job_543_1767101731_0.jpg', '2025-12-30 19:05:31');
INSERT INTO `transaction_images` VALUES ('40', '543', 'uploads/transactions/job_543_1767101731_1.jpg', '2025-12-30 19:05:31');
INSERT INTO `transaction_images` VALUES ('41', '464', 'uploads/transactions/job_464_1767170418_0.jpg', '2025-12-31 14:10:18');
INSERT INTO `transaction_images` VALUES ('42', '464', 'uploads/transactions/job_464_1767170418_1.jpg', '2025-12-31 14:10:18');
INSERT INTO `transaction_images` VALUES ('43', '544', 'uploads/transactions/job_544_1767183805_0.jpg', '2025-12-31 17:53:25');
INSERT INTO `transaction_images` VALUES ('44', '545', 'uploads/transactions/job_545_1767339229_0.jpg', '2026-01-02 13:03:49');
INSERT INTO `transaction_images` VALUES ('45', '548', 'uploads/transactions/job_548_1767449675_0.jpg', '2026-01-03 19:44:35');
INSERT INTO `transaction_images` VALUES ('46', '548', 'uploads/transactions/job_548_1767449675_1.jpg', '2026-01-03 19:44:35');
INSERT INTO `transaction_images` VALUES ('47', '548', 'uploads/transactions/job_548_1767449675_2.jpg', '2026-01-03 19:44:35');
INSERT INTO `transaction_images` VALUES ('48', '550', 'uploads/transactions/job_550_1767604559_0.jpg', '2026-01-05 14:45:59');
INSERT INTO `transaction_images` VALUES ('49', '551', 'uploads/transactions/job_551_1767604637_0.jpg', '2026-01-05 14:47:17');
INSERT INTO `transaction_images` VALUES ('50', '552', 'uploads/transactions/job_552_1767608433_0.jpg', '2026-01-05 15:50:33');
INSERT INTO `transaction_images` VALUES ('51', '560', 'uploads/transactions/job_560_1767780874_0.jpg', '2026-01-07 15:44:34');
INSERT INTO `transaction_images` VALUES ('52', '561', 'uploads/transactions/job_561_1767783135_0.jpg', '2026-01-07 16:22:15');
INSERT INTO `transaction_images` VALUES ('53', '562', 'uploads/transactions/job_562_1767783780_0.jpg', '2026-01-07 16:33:00');
INSERT INTO `transaction_images` VALUES ('54', '592', 'uploads/transactions/job_592_1768050071_0.jpg', '2026-01-10 18:31:11');
INSERT INTO `transaction_images` VALUES ('55', '653', 'uploads/transactions/job_653_1768565409_0.jpg', '2026-01-16 17:40:09');
INSERT INTO `transaction_images` VALUES ('57', '682', 'uploads/transactions/job_682_1769008090_0.jpg', '2026-01-21 20:38:10');
INSERT INTO `transaction_images` VALUES ('58', '684', 'uploads/transactions/job_684_1769061803_0.jpg', '2026-01-22 11:33:23');
INSERT INTO `transaction_images` VALUES ('59', '686', 'uploads/transactions/job_686_1769068462_0.jpg', '2026-01-22 13:24:22');
INSERT INTO `transaction_images` VALUES ('60', '686', 'uploads/transactions/job_686_1769068462_1.jpg', '2026-01-22 13:24:22');
INSERT INTO `transaction_images` VALUES ('61', '685', 'uploads/transactions/job_685_1769068543_0.jpg', '2026-01-22 13:25:43');
INSERT INTO `transaction_images` VALUES ('62', '685', 'uploads/transactions/job_685_1769068543_1.jpg', '2026-01-22 13:25:43');
INSERT INTO `transaction_images` VALUES ('63', '716', 'uploads/transactions/job_716_1769518142_0.jpg', '2026-01-27 18:19:02');

DROP TABLE IF EXISTS `transaction_list`;
CREATE TABLE `transaction_list` (
  `id` int(30) NOT NULL AUTO_INCREMENT,
  `user_id` int(30) NOT NULL,
  `mechanic_id` int(30) DEFAULT NULL,
  `code` varchar(100) NOT NULL,
  `job_id` varchar(20) DEFAULT NULL,
  `client_name` text DEFAULT NULL,
  `fault` text NOT NULL,
  `remark` text NOT NULL,
  `item` text NOT NULL,
  `uniq_id` text NOT NULL,
  `amount` float(15,2) NOT NULL DEFAULT 0.00,
  `mechanic_amount` float(12,2) NOT NULL DEFAULT 0.00,
  `mechanic_commission_amount` float(12,2) DEFAULT 0.00,
  `del_status` tinyint(2) NOT NULL DEFAULT 0 COMMENT '0=In Shop,\r\n1=Delivered',
  `status` tinyint(2) NOT NULL DEFAULT 0 COMMENT '0=Pending,\r\n1=On-Progress,\r\n2=Done,\r\n3=Paid,\r\n4=Cancelled,\r\n5=Delivered',
  `date_created` datetime NOT NULL DEFAULT current_timestamp(),
  `date_updated` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `date_completed` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `mechanic_id` (`mechanic_id`),
  CONSTRAINT `mechanic_id_fk_tl` FOREIGN KEY (`mechanic_id`) REFERENCES `mechanic_list` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `user_id_fk_tl` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=790 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `transaction_list` VALUES ('38', '5', '2', '2025102401', '27270', '5', 'No lamp', '27270', 'Sharpy stan12r', '27270', '750.00', '0.00', '0.00', '0', '5', '2025-10-24 14:46:55', '2025-10-24 14:46:55', '2025-10-24 14:46:55');
INSERT INTO `transaction_list` VALUES ('39', '5', '2', '2025102402', '27271', '5', 'No lamp', '27271', 'Sharpy stan12r', '27271', '750.00', '0.00', '0.00', '0', '5', '2025-10-24 14:48:18', '2025-10-24 14:48:18', '2025-10-24 14:48:18');
INSERT INTO `transaction_list` VALUES ('40', '3', '2', '2025102403', '27268', '6', 'No smoke', '27268', 'Fog 2000w Stan', '27268', '1500.00', '0.00', '0.00', '0', '5', '2025-10-24 15:43:14', '2025-10-24 15:43:14', '2025-10-24 15:43:14');
INSERT INTO `transaction_list` VALUES ('41', '3', '1', '2025102404', '27269', '3', 'Door open error', '27269 repaired ok', 'Microwave pcb', '27269', '650.00', '0.00', '65.00', '1', '5', '2025-10-24 15:47:38', '2025-10-24 15:47:38', '2025-10-24 15:47:38');
INSERT INTO `transaction_list` VALUES ('42', '4', '1', '2025102501', '27274', '8', 'No Display', 'Lock Broken, NoDisplay, Wire Boken', 'Sharpy Stan 10r Axis', '27274', '1500.00', '0.00', '0.00', '0', '5', '2025-10-25 12:38:44', '2025-10-25 12:38:44', '2025-10-25 12:38:44');
INSERT INTO `transaction_list` VALUES ('43', '4', '2', '2025102502', '27275', '8', 'X not Working', 'Returning job old job id 27051 
Coard repair 8841 change', 'Sharpy Stan 10r Axis', '27275', '1500.00', '0.00', '0.00', '0', '5', '2025-10-25 12:41:05', '2025-10-25 12:41:05', '2025-10-25 12:41:05');
INSERT INTO `transaction_list` VALUES ('44', '4', '1', '2025102301', '27267', '9', 'show error', 'khuli hui laya hai baki saman nahi aaya hai', 'Sparkaler S-Pro v2', '27267', '2500.00', '0.00', '0.00', '0', '5', '2025-10-23 15:11:14', '2025-10-23 15:11:14', '2025-10-23 15:11:14');
INSERT INTO `transaction_list` VALUES ('45', '4', '2', '2025102503', '27276', '10', 'to be diagnosed', 'none', 'Par Light', '27276', '300.00', '0.00', '0.00', '0', '5', '2025-10-25 15:15:00', '2025-10-25 15:15:00', '2025-10-25 15:15:00');
INSERT INTO `transaction_list` VALUES ('46', '4', '2', '2025102504', '27277', '10', 'to be diagnosed', 'none', 'Par Light Zenith', '27277', '300.00', '0.00', '0.00', '0', '2', '2025-10-25 15:18:44', '2026-01-11 18:48:47', '');
INSERT INTO `transaction_list` VALUES ('47', '4', '2', '2025102505', '27278', '10', 'to be diagnosed', 'none', 'Par Light Zenith', '27278', '300.00', '0.00', '0.00', '0', '2', '2025-10-25 15:19:59', '2026-01-11 18:49:15', '');
INSERT INTO `transaction_list` VALUES ('48', '4', '2', '2025102506', '27279', '10', 'to be diagnosed', 'none', 'Par Light Zenith', '27279', '300.00', '0.00', '0.00', '0', '5', '2025-10-25 15:21:25', '2025-10-25 15:21:25', '2025-10-25 15:21:25');
INSERT INTO `transaction_list` VALUES ('49', '4', '2', '2025102507', '27280', '10', 'to be diagnosed', 'none', 'Par Light Zenith', '27280', '800.00', '0.00', '0.00', '0', '5', '2025-10-25 15:22:21', '2025-10-25 15:22:21', '2025-10-25 15:22:21');
INSERT INTO `transaction_list` VALUES ('50', '4', '2', '2025102508', '27281', '10', 'to be diagnosed', 'none', 'Par Light Zenith', '27281', '300.00', '0.00', '0.00', '0', '5', '2025-10-25 15:23:16', '2025-10-25 15:23:16', '2025-10-25 15:23:16');
INSERT INTO `transaction_list` VALUES ('51', '4', '2', '2025102509', '27282', '10', 'to be diagnosed', 'none', 'Par Light Zenith', '27282', '300.00', '0.00', '0.00', '0', '5', '2025-10-25 15:25:11', '2025-10-25 15:25:11', '2025-10-25 15:25:11');
INSERT INTO `transaction_list` VALUES ('52', '4', '2', '2025102510', '27283', '10', 'to be diagnosed', 'none', 'Par Light Zenith', '27283', '300.00', '0.00', '0.00', '0', '5', '2025-10-25 15:26:33', '2025-10-25 15:26:33', '2025-10-25 15:26:33');
INSERT INTO `transaction_list` VALUES ('53', '4', '2', '2025102511', '27284', '10', 'to be diagnosed', 'none', 'Par Light Zenith', '27284', '300.00', '0.00', '0.00', '0', '5', '2025-10-25 15:27:47', '2025-10-25 15:27:47', '2025-10-25 15:27:47');
INSERT INTO `transaction_list` VALUES ('54', '4', '2', '2025102512', '27285', '8', 'Fader ', 'none', '1024 Mini Pearl Stan', '27285', '0.00', '0.00', '0.00', '0', '5', '2025-10-25 15:29:01', '2025-10-25 15:29:01', '2025-10-25 15:29:01');
INSERT INTO `transaction_list` VALUES ('55', '4', '1', '2025102601', '27286', '11', 'one channel not working', 'none', 'Crossover dbx 234xs', '27286', '0.00', '0.00', '0.00', '0', '5', '2025-10-26 20:53:33', '2025-10-26 20:53:33', '2025-10-26 20:53:33');
INSERT INTO `transaction_list` VALUES ('56', '4', '1', '2025102602', '27287', '12', 'no audio', 'Anurag pachori bhaiya', 'Amplifier dsh 6500', '27287', '0.00', '0.00', '0.00', '0', '0', '2025-10-26 20:57:01', '2025-10-26 20:57:01', '');
INSERT INTO `transaction_list` VALUES ('57', '4', '2', '2025102701', '27288', '13', 'handle burned', 'none', 'SMD KT 786', '24288', '0.00', '0.00', '0.00', '0', '5', '2025-10-27 21:12:32', '2025-10-27 21:12:32', '2025-10-27 21:12:32');
INSERT INTO `transaction_list` VALUES ('58', '4', '2', '2025102702', '27289', '14', 'No Lampand body lock broken', 'none', 'Sharpy stan 12r ', '27289', '5000.00', '0.00', '0.00', '0', '5', '2025-10-27 21:15:42', '2025-10-27 21:15:42', '2025-10-27 21:15:42');
INSERT INTO `transaction_list` VALUES ('59', '4', '2', '2025102703', '27290', '15', 'For test', 'None', 'Seperator', '27290', '0.00', '0.00', '0.00', '0', '5', '2025-10-27 21:20:38', '2025-10-27 21:20:38', '2025-10-27 21:20:38');
INSERT INTO `transaction_list` VALUES ('60', '4', '1', '2025102704', '27291', '2', 'Body Broken', 'none', 'Sharpy Monster King 350', '27291', '1500.00', '0.00', '0.00', '0', '5', '2025-10-27 21:23:02', '2025-10-27 21:23:02', '2025-10-27 21:23:02');
INSERT INTO `transaction_list` VALUES ('61', '4', '2', '2025102705', '27292', '2', 'dead', 'none', 'par Light Stan Q7', '27292', '350.00', '0.00', '0.00', '0', '5', '2025-10-27 21:24:17', '2025-10-27 21:24:17', '2025-10-27 21:24:17');
INSERT INTO `transaction_list` VALUES ('62', '4', '2', '2025102706', '27293', '2', 'dead', 'none', 'par Light Stan Q7', '27293', '350.00', '0.00', '0.00', '0', '5', '2025-10-27 21:25:08', '2025-10-27 21:25:08', '2025-10-27 21:25:08');
INSERT INTO `transaction_list` VALUES ('63', '4', '2', '2025102707', '27294', '16', 'dead', 'none', 'Par Light Big Dipper', '27294', '0.00', '0.00', '0.00', '0', '5', '2025-10-27 21:28:11', '2025-10-27 21:28:11', '2025-10-27 21:28:11');
INSERT INTO `transaction_list` VALUES ('64', '4', '2', '2025102708', '27295', '16', 'dead', 'none', 'Par Light 36 Led', '27295', '300.00', '0.00', '0.00', '0', '5', '2025-10-27 21:29:35', '2025-10-27 21:29:35', '2025-10-27 21:29:35');
INSERT INTO `transaction_list` VALUES ('65', '4', '1', '2025102801', '27296', '16', 'dead', 'none', 'Sharpy SMPS', '27296', '650.00', '0.00', '0.00', '0', '5', '2025-10-27 21:30:21', '2025-10-27 21:30:21', '2025-10-27 21:30:21');
INSERT INTO `transaction_list` VALUES ('66', '4', '1', '2025102802', '27297', '17', 'Dead', 'Smps is short circuit', 'Sharpy stan 12r', '27297', '2000.00', '0.00', '0.00', '0', '5', '2025-10-27 21:32:39', '2025-10-27 21:32:39', '2025-10-27 21:32:39');
INSERT INTO `transaction_list` VALUES ('67', '4', '1', '2025102901', '27298', '8', 'Dead', 'none', 'EV Charger', '27298', '600.00', '0.00', '0.00', '0', '5', '2025-10-28 21:35:08', '2025-10-28 21:35:08', '2025-10-28 21:35:08');
INSERT INTO `transaction_list` VALUES ('68', '4', '1', '2025102902', '27299', '8', 'dead', 'none', 'Sharpy SMPS', '27299', '850.00', '0.00', '0.00', '0', '5', '2025-10-28 21:38:18', '2025-10-28 21:38:18', '2025-10-28 21:38:18');
INSERT INTO `transaction_list` VALUES ('69', '4', '2', '2025102903', '27300', '10', 'dead', 'none', 'Par Light Zenith', '27300', '250.00', '0.00', '0.00', '0', '5', '2025-10-28 21:39:47', '2025-10-28 21:39:47', '2025-10-28 21:39:47');
INSERT INTO `transaction_list` VALUES ('70', '4', '2', '2025102904', '27301', '18', 'dead', 'smps repair,', 'Sparkal S-Pro', '27301', '1500.00', '0.00', '0.00', '0', '5', '2025-10-28 23:46:34', '2025-10-28 23:46:34', '2025-10-28 23:46:34');
INSERT INTO `transaction_list` VALUES ('71', '4', '2', '2025102905', '27302', '18', 'dead', 'Blower Fan Damaged and Screw is Weraout', 'Sparkal S-Pro', '27302', '350.00', '0.00', '0.00', '0', '5', '2025-10-28 23:49:52', '2025-10-28 23:49:52', '2025-10-28 23:49:52');
INSERT INTO `transaction_list` VALUES ('72', '4', '2', '2025102906', '27303', '18', 'fuse Socket Broken', 'New Fuse socket and fuse and service', 'Sparkal Moka', '27303', '350.00', '0.00', '0.00', '0', '5', '2025-10-28 23:52:13', '2025-10-28 23:52:13', '2025-10-28 23:52:13');
INSERT INTO `transaction_list` VALUES ('73', '4', '2', '2025102907', '27304', '18', 'one side not working', 'Fan Repair And Wiring Repair because current on body', 'bubble machine 4 way', '27304', '1500.00', '0.00', '0.00', '0', '5', '2025-10-28 23:55:16', '2025-10-28 23:55:16', '2025-10-28 23:55:16');
INSERT INTO `transaction_list` VALUES ('74', '4', '2', '2025102803', '27305', '19', 'Not Working', 'Heater Parsaly choke but can be open if use frequently', 'Fog Machine', '27305', '1850.00', '0.00', '0.00', '0', '5', '2025-10-28 21:01:18', '2025-10-28 21:01:18', '2025-10-28 21:01:18');
INSERT INTO `transaction_list` VALUES ('75', '4', '1', '2025102804', '27306', '19', 'Not Working', 'none', 'Fog Machine', '27306', '350.00', '0.00', '0.00', '0', '5', '2025-10-28 21:02:47', '2025-10-28 21:02:47', '2025-10-28 21:02:47');
INSERT INTO `transaction_list` VALUES ('76', '4', '2', '2025102805', '27307', '19', 'Not Working', 'Heater percialy chock pr chal rha h', 'Fog Machine', '27307', '550.00', '0.00', '0.00', '0', '5', '2025-10-28 21:03:40', '2025-10-28 21:03:40', '2025-10-28 21:03:40');
INSERT INTO `transaction_list` VALUES ('77', '4', '1', '2025102908', '27308', '20', 'no lamp', 'made by setting change with new market 280w igniter', 'Sharpy Stan 12r', '2730', '3000.00', '0.00', '0.00', '0', '5', '2025-10-29 19:07:38', '2025-10-29 19:07:38', '2025-10-29 19:07:38');
INSERT INTO `transaction_list` VALUES ('78', '4', '2', '2025102909', '27309', '10', 'dead', '28 ko diya tha', 'Par Light Zenith', '27309', '0.00', '0.00', '0.00', '0', '0', '2025-10-29 19:11:15', '2025-10-29 19:11:15', '');
INSERT INTO `transaction_list` VALUES ('79', '4', '1', '2025102910', '27310', '21', 'Not Working', 'none', 'Screw Driver Koocu', '27310', '0.00', '0.00', '0.00', '0', '0', '2025-10-29 19:13:30', '2025-10-29 19:13:30', '');
INSERT INTO `transaction_list` VALUES ('80', '4', '2', '2025102911', '27311', '20', 'X Jammed', 'body Dameged and x lock broken', 'Sharpy Stan 12r', '27311', '1500.00', '0.00', '0.00', '0', '5', '2025-10-29 19:14:53', '2025-10-29 19:14:53', '2025-10-29 19:14:53');
INSERT INTO `transaction_list` VALUES ('81', '4', '1', '2025102912', '27312', '22', 'display Communication failed', 'sath me chalu display laye hain', 'Sharpy 10r Yellow', '27312', '1500.00', '0.00', '0.00', '0', '5', '2025-10-29 19:18:54', '2025-10-29 19:18:54', '2025-10-29 19:18:54');
INSERT INTO `transaction_list` VALUES ('82', '4', '1', '2025102913', '27313', '22', 'only for test', 'chalu disaplay hai', 'Display 10r Yellow', '27313', '0.00', '0.00', '0.00', '0', '5', '2025-10-29 19:20:23', '2025-10-29 19:20:23', '2025-10-29 19:20:23');
INSERT INTO `transaction_list` VALUES ('83', '4', '2', '2025102914', '27314', '23', 'dead', 'Smps repair', 'Par Light Mini Plastic', '27314', '300.00', '0.00', '0.00', '0', '2', '2025-10-29 19:26:00', '2025-11-14 15:00:04', '');
INSERT INTO `transaction_list` VALUES ('84', '4', '2', '2025102915', '27315', '23', 'dead', 'Smps repair', 'Par Light Mini Plastic', '27315', '300.00', '0.00', '0.00', '0', '2', '2025-10-29 19:26:48', '2025-11-14 14:59:32', '');
INSERT INTO `transaction_list` VALUES ('85', '4', '2', '2025102916', '27316', '23', 'dead', 'Smps repair
Fan12volt
', 'Par Light Mini Plastic', '27316', '450.00', '0.00', '0.00', '0', '2', '2025-10-29 19:27:31', '2025-11-14 15:01:21', '');
INSERT INTO `transaction_list` VALUES ('86', '4', '2', '2025102917', '27317', '23', 'dead', 'Smps repair', 'Par Light Mini Plastic', '27317', '300.00', '0.00', '0.00', '0', '2', '2025-10-29 19:28:23', '2025-11-14 14:58:13', '');
INSERT INTO `transaction_list` VALUES ('87', '4', '2', '2025102918', '27318', '23', 'dead', 'Fan lga 12volt 4inch mps repair
Red colour m dikkt h ', 'Par Light Mini Plastic', '27318', '450.00', '0.00', '0.00', '0', '2', '2025-10-29 19:29:05', '2025-11-09 18:04:08', '');
INSERT INTO `transaction_list` VALUES ('88', '4', '2', '2025102919', '27319', '23', 'dead', 'Smps repair', 'Par Light Mini Plastic', '217319', '300.00', '0.00', '0.00', '0', '2', '2025-10-29 19:29:52', '2025-11-14 14:57:29', '');
INSERT INTO `transaction_list` VALUES ('89', '4', '1', '2025102920', '27320', '24', 'Not Working', 'pahle ban kar gayi thi par nahi chali thi aisa bataya deepak ne', 'Fog Machine', '27320', '0.00', '0.00', '0.00', '0', '5', '2025-10-29 19:31:16', '2025-10-29 19:31:16', '2025-10-29 19:31:16');
INSERT INTO `transaction_list` VALUES ('90', '4', '1', '2025102921', '27321', '25', 'Dead', 'handle jala hua hai', 'SMD Kada 2018', '27321', '500.00', '0.00', '0.00', '0', '5', '2025-10-29 19:32:33', '2025-10-29 19:32:33', '2025-10-29 19:32:33');
INSERT INTO `transaction_list` VALUES ('91', '4', '1', '2025102922', '27322', '17', 'Body Damaged very badly', 'Body Damaged very badly', 'Sharpy A-Pro 20r', '27322', '2000.00', '0.00', '0.00', '0', '5', '2025-10-29 19:35:23', '2025-10-29 19:35:23', '2025-10-29 19:35:23');
INSERT INTO `transaction_list` VALUES ('93', '5', '1', '2025103001', '27323', '26', 'Dead', '400 de kar gaye', 'Separator Baku 999', '27323', '500.00', '0.00', '0.00', '0', '5', '2025-10-30 14:26:00', '2025-10-30 14:26:00', '2025-10-30 14:26:00');
INSERT INTO `transaction_list` VALUES ('94', '4', '2', '2025103002', '27324', '19', 'liquid out', 'none', 'fog Machine', '27324', '550.00', '0.00', '0.00', '0', '5', '2025-10-30 20:06:34', '2025-10-30 20:06:34', '2025-10-30 20:06:34');
INSERT INTO `transaction_list` VALUES ('95', '4', '1', '2025102405', '27272', '27', '2 port not working', 'none', 'Plc Control Board', '27272', '0.00', '0.00', '0.00', '0', '5', '2025-10-24 21:12:38', '2025-10-24 21:12:38', '2025-10-24 21:12:38');
INSERT INTO `transaction_list` VALUES ('96', '4', '1', '2025110201', '27325', '29', 'Dead', 'none', 'sony adapter', '27325', '0.00', '0.00', '0.00', '0', '0', '2025-11-02 18:42:09', '2025-11-02 18:42:09', '');
INSERT INTO `transaction_list` VALUES ('97', '4', '1', '2025110202', '27326', '30', 'henge', 'none', '1024 Mini Pearl Stan', '27326', '1500.00', '0.00', '150.00', '0', '5', '2025-11-02 18:54:03', '2025-11-02 18:54:03', '2025-11-02 18:54:03');
INSERT INTO `transaction_list` VALUES ('98', '4', '1', '2025110203', '27327', '18', 'Dead', 'ok', 'spin sparkal', '27327', '3500.00', '0.00', '0.00', '0', '5', '2025-11-02 19:09:43', '2025-11-02 19:09:43', '2025-11-02 19:09:43');
INSERT INTO `transaction_list` VALUES ('99', '4', '1', '2025110204', '27328', '31', 'Dead', 'only card 216', '10r yallow said card', '27328', '0.00', '0.00', '0.00', '0', '0', '2025-11-02 19:19:55', '2025-11-02 19:19:55', '');
INSERT INTO `transaction_list` VALUES ('100', '4', '1', '2025110205', '27329', '10', 'hang', 'mother board problem', '1024 Mini Pearl Stan', '27329', '0.00', '0.00', '0.00', '0', '5', '2025-11-02 19:25:18', '2025-11-02 19:25:18', '2025-11-02 19:25:18');
INSERT INTO `transaction_list` VALUES ('101', '4', '1', '2025110206', '27330', '32', 'Dead', 'noen', 'Moniter acer', '27330', '0.00', '0.00', '0.00', '0', '0', '2025-11-02 19:32:24', '2025-11-02 19:32:24', '');
INSERT INTO `transaction_list` VALUES ('102', '4', '1', '2025110207', '27331', '32', 'Dead', 'none', 'Moniter hp', '27331', '0.00', '0.00', '0.00', '0', '0', '2025-11-02 19:33:56', '2025-11-02 19:33:56', '');
INSERT INTO `transaction_list` VALUES ('103', '4', '1', '2025110208', '27332', '33', 'Matrix', 'none', '1024 Mini Pearl Stan', '27332', '0.00', '0.00', '0.00', '0', '5', '2025-11-02 19:41:44', '2025-11-02 19:41:44', '2025-11-02 19:41:44');
INSERT INTO `transaction_list` VALUES ('104', '4', '2', '2025110209', '27333', '33', 'Dead', 'none', '36\\12 200w smps', '27333', '250.00', '0.00', '0.00', '0', '5', '2025-11-02 19:44:05', '2025-11-02 19:44:05', '2025-11-02 19:44:05');
INSERT INTO `transaction_list` VALUES ('105', '4', '1', '2025110210', '27334', '34', 'Dead', 'card,smps alag se aai hai (27335,27336)', 'Sharpy Stan 10r Axis', '27334', '1800.00', '0.00', '0.00', '0', '5', '2025-11-02 19:59:41', '2025-11-02 19:59:41', '2025-11-02 19:59:41');
INSERT INTO `transaction_list` VALUES ('106', '4', '1', '2025110211', '27335', '34', 'Dead', 'job sheet (27334) me lagai', 'Sharpy SMPS', '27335', '0.00', '0.00', '0.00', '0', '5', '2025-11-02 20:17:02', '2025-11-02 20:17:02', '2025-11-02 20:17:02');
INSERT INTO `transaction_list` VALUES ('107', '4', '1', '2025110212', '27336', '34', 'Dead', 'job sheet (27334) me lagai', '10r card', '27336', '0.00', '0.00', '0.00', '0', '5', '2025-11-02 20:19:31', '2025-11-02 20:19:31', '2025-11-02 20:19:31');
INSERT INTO `transaction_list` VALUES ('108', '4', '1', '2025110213', '27337', '34', 'Dead', 'none', '10r card', '27337', '0.00', '0.00', '0.00', '0', '0', '2025-11-02 20:21:40', '2025-11-02 20:21:40', '');
INSERT INTO `transaction_list` VALUES ('109', '4', '1', '2025110214', '27338', '34', 'Dead', 'none', '10r card', '27338', '0.00', '0.00', '0.00', '0', '0', '2025-11-02 20:23:05', '2025-11-02 20:23:05', '');
INSERT INTO `transaction_list` VALUES ('110', '4', '1', '2025110215', '27339', '35', 'Dead', 'none', 'SMD KT 786', '27339', '250.00', '0.00', '0.00', '0', '5', '2025-11-02 20:30:07', '2025-11-02 20:30:07', '2025-11-02 20:30:07');
INSERT INTO `transaction_list` VALUES ('111', '4', '1', '2025110216', '27340', '35', 'not hit', 'none', 'smd rajshree', '27340', '250.00', '0.00', '0.00', '0', '5', '2025-11-02 20:31:24', '2025-11-02 20:31:24', '2025-11-02 20:31:24');
INSERT INTO `transaction_list` VALUES ('112', '4', '1', '2025110217', '27341', '36', 'side look', 'none, anuj patel 7389996926
10r axis band la kar diye hain isko le gaye shiv', 'Sharpy stan 12r', '27341', '1500.00', '0.00', '0.00', '0', '5', '2025-11-02 20:43:15', '2025-11-02 20:43:15', '2025-11-02 20:43:15');
INSERT INTO `transaction_list` VALUES ('113', '4', '1', '2025110218', '27342', '36', 'lamp', 'none, anuj patel,7389996926', 'Sharpy stan 12r', '27342', '3000.00', '0.00', '0.00', '0', '5', '2025-11-02 20:44:57', '2025-11-02 20:44:57', '2025-11-02 20:44:57');
INSERT INTO `transaction_list` VALUES ('114', '4', '2', '2025110219', '27273', '20', 'Led', 'none', 'Par Light lpc007', '27273', '250.00', '0.00', '0.00', '0', '5', '2025-11-02 21:14:15', '2025-11-02 21:14:15', '2025-11-02 21:14:15');
INSERT INTO `transaction_list` VALUES ('115', '3', '2', '2025110301', '27349', '2', 'Liquid aa rha hai', 'Sensor kharab tha new dala hai ', 'Fog 2000w monylight rocket', '27349', '500.00', '0.00', '0.00', '0', '5', '2025-11-03 17:54:11', '2025-11-03 17:54:11', '2025-11-03 17:54:11');
INSERT INTO `transaction_list` VALUES ('116', '4', '1', '2025110302', '27345', '38', 'Dead', 'None', '5v 60a smps', '27345', '500.00', '0.00', '0.00', '0', '5', '2025-11-03 20:46:21', '2025-11-03 20:46:21', '2025-11-03 20:46:21');
INSERT INTO `transaction_list` VALUES ('117', '4', '1', '2025110401', '27343', '14', 'Malfunction in a file', 'None', 'Stan 1024', '27343', '0.00', '0.00', '0.00', '0', '5', '2025-11-03 21:39:09', '2025-11-03 21:39:09', '2025-11-03 21:39:09');
INSERT INTO `transaction_list` VALUES ('118', '4', '1', '2025110402', '27346', '38', 'dead', 'none', '5v 60a smps', '27346', '500.00', '0.00', '0.00', '0', '5', '2025-11-04 14:39:55', '2025-11-04 14:39:55', '2025-11-04 14:39:55');
INSERT INTO `transaction_list` VALUES ('119', '4', '1', '2025110403', '27344', '39', 'dead', 'vary badly burnt', 'PLC Drive ', '27344', '0.00', '0.00', '0.00', '0', '5', '2025-11-04 14:41:50', '2025-11-04 14:41:50', '2025-11-04 14:41:50');
INSERT INTO `transaction_list` VALUES ('120', '4', '1', '2025110404', '27347', '38', 'dead', 'none', '5v 60a smps', '27347', '500.00', '0.00', '0.00', '0', '5', '2025-11-04 14:43:21', '2025-11-04 14:43:21', '2025-11-04 14:43:21');
INSERT INTO `transaction_list` VALUES ('121', '4', '1', '2025110405', '27348', '38', 'dead', 'none', '5v 60a smps', '27348', '500.00', '0.00', '0.00', '0', '5', '2025-11-04 14:44:15', '2025-11-04 14:44:15', '2025-11-04 14:44:15');
INSERT INTO `transaction_list` VALUES ('122', '4', '2', '2025110406', '27350', '2', 'no fog', 'none', 'Fog 2000w monylight rocket', '27350', '1850.00', '0.00', '0.00', '0', '5', '2025-11-04 14:47:24', '2025-11-04 14:47:24', '2025-11-04 14:47:24');
INSERT INTO `transaction_list` VALUES ('123', '4', '2', '2025110407', '27351', '2', 'no fog', 'none', 'Fog 2000w monylight rocket', '27351', '500.00', '0.00', '0.00', '0', '5', '2025-11-04 14:56:25', '2025-11-04 14:56:25', '2025-11-04 14:56:25');
INSERT INTO `transaction_list` VALUES ('124', '4', '1', '2025110408', '27352', '35', 'No Vaccume', 'none', 'Seperator', '27352', '300.00', '0.00', '0.00', '0', '5', '2025-11-04 14:58:17', '2025-11-04 14:58:17', '2025-11-04 14:58:17');
INSERT INTO `transaction_list` VALUES ('125', '4', '1', '2025110409', '27353', '2', 'DMX not work', 'none', 'Splitter Jia', '27353', '0.00', '0.00', '0.00', '0', '0', '2025-11-04 14:59:54', '2025-11-04 14:59:54', '');
INSERT INTO `transaction_list` VALUES ('126', '4', '1', '2025110410', '27354', '2', 'DMX not work', 'none', 'Splitter Jia', '27254', '0.00', '0.00', '0.00', '0', '0', '2025-11-04 15:00:44', '2025-11-07 01:17:47', '');
INSERT INTO `transaction_list` VALUES ('127', '4', '1', '2025110411', '27355', '2', 'DMX not work', 'none', 'Battan Light Stan', '27355', '0.00', '0.00', '0.00', '0', '0', '2025-11-04 15:02:17', '2025-11-04 15:02:17', '');
INSERT INTO `transaction_list` VALUES ('128', '4', '1', '2025110501', '27356', '40', 'Dead', 'none', '5v 60a smps', 'B1', '500.00', '0.00', '50.00', '0', '2', '2025-11-05 11:45:36', '2026-01-02 15:17:33', '');
INSERT INTO `transaction_list` VALUES ('129', '4', '1', '2025110502', '27357', '40', 'Dead', 'None', '5v 60a smps', '25357', '500.00', '0.00', '0.00', '0', '5', '2025-11-05 11:46:28', '2025-11-05 11:46:28', '2025-11-05 11:46:28');
INSERT INTO `transaction_list` VALUES ('130', '4', '1', '2025110503', '27358', '40', 'Dead', 'None', '5v 60a smps', '27358', '500.00', '0.00', '0.00', '0', '5', '2025-11-05 11:47:13', '2025-11-05 11:47:13', '2025-11-05 11:47:13');
INSERT INTO `transaction_list` VALUES ('131', '4', '2', '2025110504', '27359', '40', 'Dead', 'None', '5v 60a smps', 'B1', '0.00', '0.00', '0.00', '0', '4', '2025-11-05 11:48:03', '2026-01-02 15:23:20', '');
INSERT INTO `transaction_list` VALUES ('132', '4', '1', '2025110505', '27360', '40', 'Dead', 'None', '5v 60a smps', '27360', '500.00', '0.00', '0.00', '0', '5', '2025-11-05 11:48:50', '2025-11-05 11:48:50', '2025-11-05 11:48:50');
INSERT INTO `transaction_list` VALUES ('133', '4', '2', '2025110506', '27361', '41', 'bubbles not forms', 'Pump motor kharab hai', 'Bubble machine 2 out', '27361', '1500.00', '0.00', '0.00', '0', '5', '2025-11-05 13:52:42', '2025-11-05 13:52:42', '2025-11-05 13:52:42');
INSERT INTO `transaction_list` VALUES ('134', '4', '1', '2025110507', '27362', '38', 'dead', 'None', '5v 60a smps', 'B1', '500.00', '0.00', '50.00', '0', '2', '2025-11-05 17:49:03', '2026-01-02 20:27:16', '');
INSERT INTO `transaction_list` VALUES ('135', '4', '1', '2025110701', '27363', '43', 'Dead', 'Rohit Sahu ki hain
Smps repair', 'Par Light Lpc007', '27363', '350.00', '0.00', '0.00', '0', '5', '2025-11-07 01:25:12', '2025-11-07 01:25:12', '2025-11-07 01:25:12');
INSERT INTO `transaction_list` VALUES ('136', '4', '1', '2025110702', '27364', '43', 'Dead', 'Rohit Sahu ki hain
Smps repair ... Button', 'Par Light Lpc007', '27364', '350.00', '0.00', '0.00', '0', '5', '2025-11-07 01:25:58', '2025-11-07 01:25:58', '2025-11-07 01:25:58');
INSERT INTO `transaction_list` VALUES ('137', '4', '1', '2025110703', '27365', '43', 'D', 'Rohit Sahu ki hain
Smps repair', 'Par Light Lpc007', '27365', '350.00', '0.00', '0.00', '0', '5', '2025-11-07 01:26:44', '2025-11-07 01:26:44', '2025-11-07 01:26:44');
INSERT INTO `transaction_list` VALUES ('138', '4', '1', '2025110704', '27366', '43', 'Dead', 'Rohit Sahu ki hain
Smps repair ... Fan28volt
Tawa m dikkt h blue colour', 'Par Light Lpc007', '27366', '500.00', '0.00', '0.00', '0', '5', '2025-11-07 01:27:25', '2025-11-07 01:27:25', '2025-11-07 01:27:25');
INSERT INTO `transaction_list` VALUES ('139', '4', '1', '2025110705', '27367', '43', 'Dead', 'Rohit Sahu ki hain
Smps repair', 'Par Light Lpc007', '27367', '350.00', '0.00', '0.00', '0', '5', '2025-11-07 01:28:08', '2025-11-07 01:28:08', '2025-11-07 01:28:08');
INSERT INTO `transaction_list` VALUES ('140', '4', '1', '2025110706', '27368', '19', 'show error', 'display repair', 'Shjarpy Saif', '27368', '1500.00', '0.00', '0.00', '0', '5', '2025-11-07 01:29:21', '2025-11-07 01:29:21', '2025-11-07 01:29:21');
INSERT INTO `transaction_list` VALUES ('141', '4', '1', '2025110707', '27369', '19', 'show error', 'Igniter dala h ', 'Shjarpy Saif', '27369', '3000.00', '0.00', '0.00', '0', '5', '2025-11-07 01:30:21', '2025-11-07 01:30:21', '2025-11-07 01:30:21');
INSERT INTO `transaction_list` VALUES ('142', '4', '1', '2025110708', '27370', '19', 'show error', 'none', 'Shjarpy Saif', '27370', '5100.00', '0.00', '0.00', '0', '5', '2025-11-07 01:31:18', '2025-11-07 01:31:18', '2025-11-07 01:31:18');
INSERT INTO `transaction_list` VALUES ('143', '4', '1', '2025110709', '27371', '44', 'Dead', 'none', '5v 60a smps', '27371', '500.00', '0.00', '0.00', '0', '5', '2025-11-07 01:33:23', '2025-11-07 01:33:23', '2025-11-07 01:33:23');
INSERT INTO `transaction_list` VALUES ('144', '4', '1', '2025110710', '27372', '44', 'Dead', 'None', '5v 60a smps', '27372', '500.00', '0.00', '0.00', '0', '5', '2025-11-07 01:34:21', '2025-11-07 01:34:21', '2025-11-07 01:34:21');
INSERT INTO `transaction_list` VALUES ('145', '4', '1', '2025110711', '27373', '44', 'Dead', 'None', '5v 60a smps', '27373', '500.00', '0.00', '0.00', '0', '5', '2025-11-07 01:35:34', '2025-11-07 01:35:34', '2025-11-07 01:35:34');
INSERT INTO `transaction_list` VALUES ('146', '4', '1', '2025110712', '27374', '45', 'Dead', 'None', 'DMX 512', '27374', '450.00', '0.00', '0.00', '0', '5', '2025-11-07 01:36:37', '2025-11-07 01:36:37', '2025-11-07 01:36:37');
INSERT INTO `transaction_list` VALUES ('147', '4', '1', '2025110713', '27375', '2', 'Blue not works', 'None', 'Leser Light', '27375', '0.00', '0.00', '0.00', '0', '5', '2025-11-07 01:38:07', '2025-11-07 01:38:07', '2025-11-07 01:38:07');
INSERT INTO `transaction_list` VALUES ('148', '4', '1', '2025110714', '27376', '2', 'Body Bend', 'Body bend repair side lock repair ', 'Sharpy Stan 12R', '27376', '2000.00', '0.00', '0.00', '0', '5', '2025-11-07 01:39:37', '2025-11-07 01:39:37', '2025-11-07 01:39:37');
INSERT INTO `transaction_list` VALUES ('149', '4', '1', '2025110715', '27377', '2', 'display and dmx command not working', 'Prism khula tha bo kiya .  Card se socket dheela tha bo kiya fuse sahi kiya ', 'Sharpy Stan 12R', '27377', '1500.00', '0.00', '0.00', '0', '5', '2025-11-07 01:40:33', '2025-11-07 01:40:33', '2025-11-07 01:40:33');
INSERT INTO `transaction_list` VALUES ('150', '4', '1', '2025110716', '27378', '2', 'Dead', 'Wire toote the moter senser k ', 'Sharpy Stan 20R', '27378', '1500.00', '0.00', '0.00', '0', '5', '2025-11-07 01:42:09', '2025-11-07 01:42:09', '2025-11-07 01:42:09');
INSERT INTO `transaction_list` VALUES ('151', '4', '1', '2025110717', '27379', '2', 'Dead', 'Ok thi wapas gai', 'Sharpy Stan 20R', '27379', '0.00', '0.00', '0.00', '0', '5', '2025-11-07 01:43:31', '2025-11-07 01:43:31', '2025-11-07 01:43:31');
INSERT INTO `transaction_list` VALUES ('152', '4', '1', '2025110718', '27021', '2', 'one led not working ', 'Display repair and new led', 'worm par stan', '27021', '500.00', '0.00', '0.00', '0', '5', '2025-11-07 06:06:58', '2025-11-07 06:06:58', '2025-11-07 06:06:58');
INSERT INTO `transaction_list` VALUES ('153', '4', '2', '2025110719', '27380', '47', 'Y and X Malfunction', 'None', 'Sharpy Stan 12R', '27380', '1500.00', '0.00', '0.00', '0', '5', '2025-11-07 12:53:46', '2025-11-07 12:53:46', '2025-11-07 12:53:46');
INSERT INTO `transaction_list` VALUES ('154', '4', '2', '2025110720', '27381', '46', 'Dead', 'None', 'Fog 1500w', '27381', '700.00', '0.00', '0.00', '0', '5', '2025-11-07 12:55:10', '2025-11-07 12:55:10', '2025-11-07 12:55:10');
INSERT INTO `transaction_list` VALUES ('155', '4', '2', '2025110721', '27382', '46', 'Dead', 'Heater lga h ', 'Sparkler stan', '27382', '2500.00', '0.00', '0.00', '0', '5', '2025-11-07 12:56:21', '2025-11-07 12:56:21', '2025-11-07 12:56:21');
INSERT INTO `transaction_list` VALUES ('156', '4', '2', '2025110722', '27383', '46', 'Daed', 'None', 'Sparkler stan', '27383', '1500.00', '0.00', '0.00', '0', '5', '2025-11-07 12:57:16', '2025-11-07 12:57:16', '2025-11-07 12:57:16');
INSERT INTO `transaction_list` VALUES ('157', '4', '2', '2025110723', '27384', '46', 'Daed', 'Buten dali h ', 'Par Light BigDipper', '27384', '200.00', '0.00', '0.00', '0', '5', '2025-11-07 12:58:22', '2025-11-07 12:58:22', '2025-11-07 12:58:22');
INSERT INTO `transaction_list` VALUES ('158', '4', '2', '2025110724', '27385', '46', 'Dead', 'Smps repair', 'Par Light BigDipper', '27385', '350.00', '0.00', '0.00', '0', '5', '2025-11-07 13:08:31', '2025-11-07 13:08:31', '2025-11-07 13:08:31');
INSERT INTO `transaction_list` VALUES ('159', '4', '2', '2025110725', '27386', '46', 'Dead', 'None', 'Par Light BigDipper', '27386', '1250.00', '0.00', '0.00', '0', '5', '2025-11-07 13:09:24', '2025-11-07 13:09:24', '2025-11-07 13:09:24');
INSERT INTO `transaction_list` VALUES ('160', '4', '2', '2025110726', '27387', '46', 'Dead', 'Sama doosri par ka lagaya isi ki', 'Par Light BigDipper', '27387', '200.00', '0.00', '0.00', '0', '5', '2025-11-07 13:10:04', '2025-11-07 13:10:04', '2025-11-07 13:10:04');
INSERT INTO `transaction_list` VALUES ('161', '4', '2', '2025110727', '27388', '46', 'Dead', 'New tawa', 'Par Light BigDipper', '27388', '700.00', '0.00', '0.00', '0', '5', '2025-11-07 13:10:57', '2025-11-07 13:10:57', '2025-11-07 13:10:57');
INSERT INTO `transaction_list` VALUES ('162', '4', '2', '2025110728', '27389', '46', 'Dead', 'Tawa dala h naya', 'Par Light BigDipper', '27389', '700.00', '0.00', '0.00', '0', '5', '2025-11-07 13:11:41', '2025-11-07 13:11:41', '2025-11-07 13:11:41');
INSERT INTO `transaction_list` VALUES ('163', '4', '2', '2025110729', '27390', '46', 'Dead', 'None', 'Blinder Par', '27390', '250.00', '0.00', '0.00', '0', '5', '2025-11-07 13:12:36', '2025-11-07 13:12:36', '2025-11-07 13:12:36');
INSERT INTO `transaction_list` VALUES ('164', '4', '2', '2025110730', '27391', '46', 'Daed', 'Tested okkkk', 'Blinder Par', '27391', '0.00', '0.00', '0.00', '0', '5', '2025-11-07 13:13:47', '2025-11-07 13:13:47', '2025-11-07 13:13:47');
INSERT INTO `transaction_list` VALUES ('165', '4', '2', '2025110731', '27392', '46', 'Dead', 'Tested okkk', 'Blinder Par', '27392', '0.00', '0.00', '0.00', '0', '5', '2025-11-07 13:14:24', '2025-11-07 13:14:24', '2025-11-07 13:14:24');
INSERT INTO `transaction_list` VALUES ('166', '4', '2', '2025110732', '27393', '46', 'Dead', 'None', 'Blinder Par', '27393', '350.00', '0.00', '0.00', '0', '5', '2025-11-07 13:15:10', '2025-11-07 13:15:10', '2025-11-07 13:15:10');
INSERT INTO `transaction_list` VALUES ('167', '4', '2', '2025110733', '27394', '46', 'Dead', 'Tested  okk', 'Blinder Par', '27394', '0.00', '0.00', '0.00', '0', '5', '2025-11-07 13:16:04', '2025-11-07 13:16:04', '2025-11-07 13:16:04');
INSERT INTO `transaction_list` VALUES ('168', '4', '1', '2025110734', '27020', '2', 'display kharab ', 'None', 'worm par', '27020', '500.00', '0.00', '0.00', '0', '5', '2025-11-07 15:22:05', '2025-11-07 15:22:05', '2025-11-07 15:22:05');
INSERT INTO `transaction_list` VALUES ('169', '4', '1', '2025110901', '27395', '48', 'Blinking', 'none', 'Dell Monitor', '27395', '0.00', '0.00', '0.00', '0', '5', '2025-11-09 15:33:37', '2025-11-09 15:33:37', '2025-11-09 15:33:37');
INSERT INTO `transaction_list` VALUES ('170', '4', '1', '2025110902', '27396', '48', 'Panel Malfunction', 'Returned', 'HCL Monitor', '27396', '0.00', '0.00', '0.00', '0', '5', '2025-11-09 15:34:39', '2025-11-09 15:34:39', '2025-11-09 15:34:39');
INSERT INTO `transaction_list` VALUES ('171', '4', '1', '2025110903', '27397', '42', 'Dead', 'Smps transformer burnt, igniter and lamp dead', 'Sharpy Stan 12R', '27397', '7070.00', '0.00', '0.00', '0', '5', '2025-11-09 15:38:22', '2025-11-09 15:38:22', '2025-11-09 15:38:22');
INSERT INTO `transaction_list` VALUES ('172', '4', '1', '2025110904', '27398', '49', 'Dead', 'None', 'Igniter 200w', '27398', '2500.00', '0.00', '0.00', '0', '0', '2025-11-09 15:44:28', '2025-11-16 14:58:54', '');
INSERT INTO `transaction_list` VALUES ('173', '4', '1', '2025110905', '27399', '33', 'Dead', 'None
Smps repair', 'Par Light Lpc007', '27399', '350.00', '0.00', '0.00', '0', '5', '2025-11-09 15:45:18', '2025-11-09 15:45:18', '2025-11-09 15:45:18');
INSERT INTO `transaction_list` VALUES ('174', '4', '2', '2025110906', '27400', '33', 'Dead', 'Smps repair 
Cable dali', 'Par Light Lpc007', '27400', '350.00', '0.00', '0.00', '0', '5', '2025-11-09 15:46:13', '2025-11-09 15:46:13', '2025-11-09 15:46:13');
INSERT INTO `transaction_list` VALUES ('175', '4', '1', '2025110907', '27401', '33', 'Dead', 'Card bhi kharab h ', 'Par Light Lpc007', '27401', '350.00', '0.00', '0.00', '0', '5', '2025-11-09 15:46:54', '2025-11-09 15:46:54', '2025-11-09 15:46:54');
INSERT INTO `transaction_list` VALUES ('176', '4', '1', '2025110908', '27402', '19', 'Dead', 'big', 'Blinder', '27402', '500.00', '0.00', '0.00', '0', '5', '2025-11-09 15:47:46', '2025-11-09 15:47:46', '2025-11-09 15:47:46');
INSERT INTO `transaction_list` VALUES ('177', '4', '1', '2025111101', '27403', '50', 'Dead ', 'Transformer burnt', 'DC Sugon', '27403', '2500.00', '0.00', '0.00', '0', '5', '2025-11-11 14:55:07', '2025-11-11 14:55:07', '2025-11-11 14:55:07');
INSERT INTO `transaction_list` VALUES ('178', '4', '1', '2025111102', '27404', '51', 'Dead', 'None', 'SMPS Par', '27404', '250.00', '0.00', '0.00', '0', '5', '2025-11-11 14:58:19', '2025-11-11 14:58:19', '2025-11-11 14:58:19');
INSERT INTO `transaction_list` VALUES ('179', '4', '1', '2025111103', '27405', '51', 'Dead', 'None', 'SMPS Par', '27405', '250.00', '0.00', '0.00', '0', '5', '2025-11-11 14:59:32', '2025-11-11 14:59:32', '2025-11-11 14:59:32');
INSERT INTO `transaction_list` VALUES ('180', '4', '1', '2025111104', '27406', '51', 'Dead', 'None', 'SMPS Par', '27406', '250.00', '0.00', '0.00', '0', '5', '2025-11-11 15:00:13', '2025-11-11 15:00:13', '2025-11-11 15:00:13');
INSERT INTO `transaction_list` VALUES ('181', '4', '1', '2025111105', '27407', '52', 'Dead', 'None', 'Adaptor Tata sky', '27407', '0.00', '0.00', '0.00', '0', '5', '2025-11-11 15:01:10', '2025-11-11 15:01:10', '2025-11-11 15:01:10');
INSERT INTO `transaction_list` VALUES ('182', '4', '2', '2025111106', '27408', '53', 'Center Lock Struck', 'None', 'Sharpy 10r axis', '27408', '1000.00', '0.00', '0.00', '0', '5', '2025-11-11 15:02:51', '2025-11-11 15:02:51', '2025-11-11 15:02:51');
INSERT INTO `transaction_list` VALUES ('183', '4', '1', '2025111301', '27409', '54', 'dead', 'none', 'Megar earth meter', '27409', '0.00', '0.00', '0.00', '0', '0', '2025-11-12 23:16:07', '2025-11-12 23:16:07', '');
INSERT INTO `transaction_list` VALUES ('184', '4', '1', '2025111302', '27410', '54', 'Dead', 'none', 'Megar earth meter', '27410', '0.00', '0.00', '0.00', '0', '0', '2025-11-12 23:17:01', '2025-11-12 23:17:01', '');
INSERT INTO `transaction_list` VALUES ('185', '4', '1', '2025111303', '27411', '54', 'Dead', 'none', 'Megar earth meter', '27411', '0.00', '0.00', '0.00', '0', '0', '2025-11-12 23:18:00', '2025-11-12 23:18:00', '');
INSERT INTO `transaction_list` VALUES ('186', '4', '1', '2025111304', '27412', '54', 'Dead', 'none', 'Megar earth meter', '27412', '0.00', '0.00', '0.00', '0', '0', '2025-11-12 23:18:46', '2025-11-12 23:18:46', '');
INSERT INTO `transaction_list` VALUES ('187', '4', '1', '2025111305', '27413', '55', 'current leak', 'sumit k', '5v 60a SMPS', '27413', '0.00', '0.00', '0.00', '0', '0', '2025-11-12 23:20:23', '2025-11-12 23:20:23', '');
INSERT INTO `transaction_list` VALUES ('188', '4', '1', '2025111306', '27414', '55', 'current leak', 'sumit k', '5v 60a SMPS', '27414', '500.00', '0.00', '0.00', '0', '5', '2025-11-12 23:21:34', '2025-11-12 23:21:34', '2025-11-12 23:21:34');
INSERT INTO `transaction_list` VALUES ('189', '4', '1', '2025111307', '27415', '47', 'Display dead', 'none', 'DMX 240', '27415', '800.00', '0.00', '0.00', '0', '5', '2025-11-12 23:24:31', '2025-11-12 23:24:31', '2025-11-12 23:24:31');
INSERT INTO `transaction_list` VALUES ('190', '4', '2', '2025111308', '27416', '56', 'led prob', 'none', 'Par LPC007', '27416', '0.00', '0.00', '0.00', '0', '0', '2025-11-12 23:26:15', '2025-11-12 23:26:15', '');
INSERT INTO `transaction_list` VALUES ('191', '4', '2', '2025111309', '27417', '56', 'led prob', 'none', 'Par LPC007', '27417', '0.00', '0.00', '0.00', '0', '0', '2025-11-12 23:27:54', '2025-11-12 23:27:54', '');
INSERT INTO `transaction_list` VALUES ('192', '4', '1', '2025111310', '27418', '57', 'keys improper works', 'none', 'plc', '27418', '1200.00', '0.00', '0.00', '0', '5', '2025-11-12 23:29:25', '2025-11-12 23:29:25', '2025-11-12 23:29:25');
INSERT INTO `transaction_list` VALUES ('193', '4', '1', '2025111311', '27419', '58', 'burnt', 'none', 'Display Stan 10R', '27419', '1000.00', '0.00', '0.00', '0', '5', '2025-11-12 23:31:04', '2025-11-12 23:31:04', '2025-11-12 23:31:04');
INSERT INTO `transaction_list` VALUES ('194', '4', '1', '2025111312', '27420', '58', 'burnt', 'none', 'Display Stan 10R', '27420', '1000.00', '0.00', '0.00', '0', '5', '2025-11-12 23:31:57', '2025-11-12 23:31:57', '2025-11-12 23:31:57');
INSERT INTO `transaction_list` VALUES ('195', '4', '1', '2025111313', '27421', '59', 'Dead', 'none', '4 Eyes', '27421', '0.00', '0.00', '0.00', '0', '0', '2025-11-12 23:33:53', '2025-11-12 23:33:53', '');
INSERT INTO `transaction_list` VALUES ('196', '4', '2', '2025111314', '27422', '60', 'Dead', 'SMPS and Ignore Both Burnt
SMPS repair, new igniter', 'Monster Stan 350', '27422', '3800.00', '0.00', '0.00', '0', '5', '2025-11-13 14:06:30', '2025-11-13 14:06:30', '2025-11-13 14:06:30');
INSERT INTO `transaction_list` VALUES ('197', '4', '1', '2025111315', '27423', '51', 'Dead', 'None', 'Par SMPS 28v', '27423', '0.00', '0.00', '0.00', '0', '4', '2025-11-13 20:38:14', '2026-01-20 14:56:43', '');
INSERT INTO `transaction_list` VALUES ('198', '4', '2', '2025111316', '27424', '51', 'Dead', 'none', 'Par SMPS 28v', '27424', '250.00', '0.00', '0.00', '0', '5', '2025-11-13 20:39:11', '2025-11-13 20:39:11', '2025-11-13 20:39:11');
INSERT INTO `transaction_list` VALUES ('199', '4', '1', '2025111317', '27425', '39', 'Dead', 'none', 'PLC', '27425', '0.00', '0.00', '0.00', '0', '0', '2025-11-13 20:40:03', '2025-11-13 20:40:03', '');
INSERT INTO `transaction_list` VALUES ('200', '4', '1', '2025111318', '27426', '39', 'Dead', 'none', 'PLC', '27426', '0.00', '0.00', '0.00', '0', '0', '2025-11-13 20:40:56', '2025-11-13 20:40:56', '');
INSERT INTO `transaction_list` VALUES ('201', '4', '1', '2025111319', '27427', '39', 'Dead', 'none', 'Plant Controller', '27427', '0.00', '0.00', '0.00', '0', '0', '2025-11-13 20:42:29', '2025-11-13 20:42:29', '');
INSERT INTO `transaction_list` VALUES ('202', '4', '2', '2025111320', '27428', '61', 'Handle Burnt', 'none', 'SMD Mechenic', '27428', '250.00', '0.00', '0.00', '0', '5', '2025-11-13 20:43:44', '2025-11-13 20:43:44', '2025-11-13 20:43:44');
INSERT INTO `transaction_list` VALUES ('203', '4', '1', '2025111321', '27429', '62', 'No Lamp', 'Focus Motor error', 'Sharpy 12R Stan', '27429', '3000.00', '0.00', '0.00', '0', '5', '2025-11-13 20:45:48', '2025-11-13 20:45:48', '2025-11-13 20:45:48');
INSERT INTO `transaction_list` VALUES ('204', '4', '2', '2025111322', '27430', '63', 'Led Board', 'None', 'MI Bar Cospo', '27430', '0.00', '0.00', '0.00', '0', '5', '2025-11-13 20:48:27', '2026-01-23 15:58:38', '2026-01-23 15:58:38');
INSERT INTO `transaction_list` VALUES ('205', '4', '2', '2025111323', '27431', '63', 'Led Board', 'none', 'MI Bar Cospo', '27431', '0.00', '0.00', '0.00', '0', '5', '2025-11-13 20:49:04', '2026-01-23 15:58:25', '2026-01-23 15:58:25');
INSERT INTO `transaction_list` VALUES ('206', '4', '2', '2025111324', '27432', '63', 'Led Board', 'none', 'MI Bar Cospo', '27432', '0.00', '0.00', '0.00', '0', '5', '2025-11-13 20:49:37', '2026-01-23 15:58:14', '2026-01-23 15:58:14');
INSERT INTO `transaction_list` VALUES ('207', '4', '2', '2025111325', '27433', '63', 'Led Board', 'none', 'MI Bar Cospo', '27433', '0.00', '0.00', '0.00', '0', '5', '2025-11-13 20:50:20', '2026-01-23 15:58:04', '2026-01-23 15:58:04');
INSERT INTO `transaction_list` VALUES ('208', '4', '1', '2025111326', '27434', '2', 'unknown', 'none', 'Smoke Rocket', '27434', '0.00', '0.00', '0.00', '0', '5', '2025-11-13 20:51:08', '2025-11-13 20:51:08', '2025-11-13 20:51:08');
INSERT INTO `transaction_list` VALUES ('209', '4', '1', '2025111327', '27435', '2', 'Blue Not working', 'none', 'Laser', '27435', '0.00', '0.00', '0.00', '0', '5', '2025-11-13 20:51:47', '2025-11-13 20:51:47', '2025-11-13 20:51:47');
INSERT INTO `transaction_list` VALUES ('210', '4', '1', '2025111401', '27436', '64', 'no lamp', 'Igniter repair and new lamp', 'Sharpy Monster 350', '27436', '5000.00', '0.00', '0.00', '0', '5', '2025-11-14 13:36:57', '2025-11-14 13:36:57', '2025-11-14 13:36:57');
INSERT INTO `transaction_list` VALUES ('211', '4', '2', '2025111402', '27437', '64', 'Dead', 'Amps dead', 'Strobe Stan', '27437', '500.00', '0.00', '0.00', '0', '5', '2025-11-14 13:43:23', '2025-11-14 13:43:23', '2025-11-14 13:43:23');
INSERT INTO `transaction_list` VALUES ('212', '4', '1', '2025111601', '27438', '67', 'Hang', 'Returned because not hang on testing', 'DMX 1024 Apro', '27438', '0.00', '0.00', '0.00', '0', '5', '2025-11-16 12:56:54', '2025-11-16 12:56:54', '2025-11-16 12:56:54');
INSERT INTO `transaction_list` VALUES ('213', '4', '2', '2025111602', '27439', '68', 'Dead', 'parts missing', 'SMPS 5v 20a', '27439', '300.00', '0.00', '0.00', '0', '5', '2025-11-16 12:58:02', '2025-11-16 12:58:02', '2025-11-16 12:58:02');
INSERT INTO `transaction_list` VALUES ('214', '4', '2', '2025111603', '27440', '68', 'Dead', 'Parts Missing', 'SMPS 5v 20a', '27440', '300.00', '0.00', '0.00', '0', '5', '2025-11-16 12:58:56', '2025-11-16 12:58:56', '2025-11-16 12:58:56');
INSERT INTO `transaction_list` VALUES ('215', '4', '2', '2025111604', '27441', '68', 'Dead', 'Parts Missing', 'SMPS 5v 20a', '27441', '0.00', '0.00', '0.00', '0', '0', '2025-11-16 12:59:36', '2025-11-16 12:59:36', '');
INSERT INTO `transaction_list` VALUES ('216', '4', '2', '2025111605', '27442', '68', 'Dead', 'Parts Missing', 'SMPS 5v 20a', '27442', '300.00', '0.00', '0.00', '0', '5', '2025-11-16 13:00:08', '2025-11-16 13:00:08', '2025-11-16 13:00:08');
INSERT INTO `transaction_list` VALUES ('217', '4', '1', '2025111606', '27443', '66', 'Piston issue', 'None', 'Swing CO2 Jet', '27443', '0.00', '0.00', '0.00', '0', '5', '2025-11-16 13:02:08', '2025-11-16 13:02:08', '2025-11-16 13:02:08');
INSERT INTO `transaction_list` VALUES ('218', '4', '2', '2025111607', '27444', '66', 'Dead', 'None', 'Swing CO2 Jet', '27444', '250.00', '0.00', '0.00', '0', '5', '2025-11-16 13:03:40', '2025-11-16 13:03:40', '2025-11-16 13:03:40');
INSERT INTO `transaction_list` VALUES ('219', '4', '2', '2025111608', '27445', '66', 'Dead', 'none', 'Swing CO2 Jet', '27445', '250.00', '0.00', '0.00', '0', '5', '2025-11-16 13:07:31', '2025-11-16 13:07:31', '2025-11-16 13:07:31');
INSERT INTO `transaction_list` VALUES ('220', '4', '1', '2025111609', '27446', '63', 'Motor Struck', 'base plate, motor, focus repair', 'Sharpy 12R Stan', '27446', '2500.00', '0.00', '0.00', '0', '5', '2025-11-16 13:09:54', '2025-11-16 13:09:54', '2025-11-16 13:09:54');
INSERT INTO `transaction_list` VALUES ('221', '4', '2', '2025111610', '27447', '59', 'Fader', '6 no. fader change', 'DMX 1024 Stan', '27447', '500.00', '0.00', '0.00', '0', '5', '2025-11-16 13:11:51', '2025-11-16 13:11:51', '2025-11-16 13:11:51');
INSERT INTO `transaction_list` VALUES ('222', '3', '2', '2025111611', '27450', '70', 'Motor', 'None', 'Bubble machine', '27450', '700.00', '0.00', '0.00', '0', '5', '2025-11-16 17:00:06', '2025-11-16 17:00:06', '2025-11-16 17:00:06');
INSERT INTO `transaction_list` VALUES ('223', '3', '2', '2025111612', '27451', '19', 'Fan', 'Fan dala h 36volt ka', '4 eyes', '27451', '450.00', '0.00', '0.00', '0', '5', '2025-11-16 18:38:05', '2025-11-16 18:38:05', '2025-11-16 18:38:05');
INSERT INTO `transaction_list` VALUES ('224', '4', '1', '2025111613', '27448', '71', 'Lock Broken', 'none', 'Sharpy Monster 650', '27448', '1500.00', '0.00', '0.00', '0', '5', '2025-11-16 19:21:41', '2025-11-16 19:21:41', '2025-11-16 19:21:41');
INSERT INTO `transaction_list` VALUES ('225', '4', '1', '2025111614', '27449', '71', 'Liquid out', 'thermostat', 'Fog BPro 2000', '27449', '600.00', '0.00', '0.00', '0', '5', '2025-11-16 19:24:08', '2025-11-16 19:24:08', '2025-11-16 19:24:08');
INSERT INTO `transaction_list` VALUES ('226', '4', '2', '2025111615', '27452', '19', 'Dead', 'None', '4 eye', '27452', '300.00', '0.00', '0.00', '0', '5', '2025-11-16 19:34:59', '2025-11-16 19:34:59', '2025-11-16 19:34:59');
INSERT INTO `transaction_list` VALUES ('227', '4', '2', '2025111616', '27453', '19', 'Dead', 'none', '4 eye', '27453', '300.00', '0.00', '0.00', '0', '5', '2025-11-16 19:35:59', '2025-11-16 19:35:59', '2025-11-16 19:35:59');
INSERT INTO `transaction_list` VALUES ('228', '3', '2', '2025111701', '27454', '73', 'Dead', 'none', 'par light', '27454', '200.00', '0.00', '0.00', '0', '5', '2025-11-17 12:45:23', '2025-11-17 12:45:23', '2025-11-17 12:45:23');
INSERT INTO `transaction_list` VALUES ('229', '4', '2', '2025111702', '27455', '73', 'Dead', 'none', 'par light', '27455', '200.00', '0.00', '0.00', '0', '5', '2025-11-17 14:40:20', '2025-11-17 14:40:20', '2025-11-17 14:40:20');
INSERT INTO `transaction_list` VALUES ('230', '4', '2', '2025111703', '27456', '73', 'Dead', 'none', 'par light', '27456', '200.00', '0.00', '0.00', '0', '5', '2025-11-17 14:41:05', '2025-11-17 14:41:05', '2025-11-17 14:41:05');
INSERT INTO `transaction_list` VALUES ('231', '4', '2', '2025111704', '27457', '73', 'Dead', 'none', 'par light', '27457', '750.00', '0.00', '0.00', '0', '5', '2025-11-17 14:58:34', '2025-11-17 14:58:34', '2025-11-17 14:58:34');
INSERT INTO `transaction_list` VALUES ('232', '4', '2', '2025111705', '27458', '73', 'Dead', 'none', 'par light', '27458', '200.00', '0.00', '0.00', '0', '5', '2025-11-17 15:00:03', '2025-11-17 15:00:03', '2025-11-17 15:00:03');
INSERT INTO `transaction_list` VALUES ('233', '4', '2', '2025111706', '27459', '73', 'Dead', 'Led plate new vinay wali
', 'par light', '27459', '200.00', '0.00', '0.00', '0', '5', '2025-11-17 15:01:30', '2025-11-17 15:01:30', '2025-11-17 15:01:30');
INSERT INTO `transaction_list` VALUES ('234', '4', '2', '2025111707', '27460', '73', 'Dead', 'none', 'par light', '27460', '200.00', '0.00', '0.00', '0', '5', '2025-11-17 15:02:40', '2025-11-17 15:02:40', '2025-11-17 15:02:40');
INSERT INTO `transaction_list` VALUES ('235', '4', '2', '2025111708', '27461', '73', 'Dead', 'none', 'par light', '27461', '200.00', '0.00', '0.00', '0', '5', '2025-11-17 15:04:04', '2025-11-17 15:04:04', '2025-11-17 15:04:04');
INSERT INTO `transaction_list` VALUES ('236', '4', '2', '2025111709', '27462', '73', 'Dead', 'none', 'par light', '27462', '200.00', '0.00', '0.00', '0', '5', '2025-11-17 15:05:24', '2025-11-17 15:05:24', '2025-11-17 15:05:24');
INSERT INTO `transaction_list` VALUES ('237', '4', '2', '2025111710', '27463', '73', 'Dead', 'none', 'par light', '27463', '200.00', '0.00', '0.00', '0', '5', '2025-11-17 15:06:34', '2025-11-17 15:06:34', '2025-11-17 15:06:34');
INSERT INTO `transaction_list` VALUES ('238', '4', '2', '2025111711', '27464', '73', 'Dead', 'none', 'par light', '27464', '200.00', '0.00', '0.00', '0', '5', '2025-11-17 15:07:41', '2025-11-17 15:07:41', '2025-11-17 15:07:41');
INSERT INTO `transaction_list` VALUES ('239', '4', '2', '2025111712', '27465', '73', 'Dead', 'none', 'par light', '27465', '200.00', '0.00', '0.00', '0', '5', '2025-11-17 15:09:00', '2025-11-17 15:09:00', '2025-11-17 15:09:00');
INSERT INTO `transaction_list` VALUES ('240', '4', '2', '2025111713', '27466', '73', 'Dead', 'none', 'par light', '27466', '200.00', '0.00', '0.00', '0', '5', '2025-11-17 15:10:10', '2025-11-17 15:10:10', '2025-11-17 15:10:10');
INSERT INTO `transaction_list` VALUES ('241', '4', '2', '2025111714', '27467', '73', 'Dead', 'none', 'par light', '27467', '200.00', '0.00', '0.00', '0', '5', '2025-11-17 15:11:17', '2025-11-17 15:11:17', '2025-11-17 15:11:17');
INSERT INTO `transaction_list` VALUES ('242', '4', '2', '2025111715', '27468', '73', 'Dead', 'none', 'par light', '27468', '200.00', '0.00', '0.00', '0', '5', '2025-11-17 15:12:33', '2025-11-17 15:12:33', '2025-11-17 15:12:33');
INSERT INTO `transaction_list` VALUES ('243', '4', '2', '2025111716', '27469', '73', 'Dead', 'none', 'par light', '27469', '200.00', '0.00', '0.00', '0', '5', '2025-11-17 15:13:48', '2025-11-17 15:13:48', '2025-11-17 15:13:48');
INSERT INTO `transaction_list` VALUES ('244', '4', '2', '2025111717', '27470', '73', 'Dead', 'none', 'par light', '27470', '200.00', '0.00', '0.00', '0', '5', '2025-11-17 15:14:54', '2025-11-17 15:14:54', '2025-11-17 15:14:54');
INSERT INTO `transaction_list` VALUES ('245', '4', '2', '2025111718', '27471', '73', 'Dead', 'none', 'par light', '27471', '200.00', '0.00', '0.00', '0', '5', '2025-11-17 15:16:04', '2025-11-17 15:16:04', '2025-11-17 15:16:04');
INSERT INTO `transaction_list` VALUES ('246', '4', '2', '2025111719', '27472', '73', 'Dead', 'none', 'par light', '27472', '200.00', '0.00', '0.00', '0', '5', '2025-11-17 15:18:42', '2025-11-17 15:18:42', '2025-11-17 15:18:42');
INSERT INTO `transaction_list` VALUES ('247', '4', '1', '2025111720', '27473', '74', 'Dead', 'none', 'Fire jia', '27473', '0.00', '0.00', '0.00', '0', '5', '2025-11-17 15:22:21', '2025-11-17 15:22:21', '2025-11-17 15:22:21');
INSERT INTO `transaction_list` VALUES ('248', '4', '1', '2025111721', '27474', '74', 'Dead', 'Gupta ji Events Gadarwara 8103030333', 'Fire jia', '27474', '0.00', '0.00', '0.00', '0', '5', '2025-11-17 15:23:34', '2025-11-17 15:23:34', '2025-11-17 15:23:34');
INSERT INTO `transaction_list` VALUES ('249', '4', '2', '2025111722', '27475', '72', 'Dead', 'returned because client want urgent repair', 'Smd Quick', '27475', '0.00', '0.00', '0.00', '0', '5', '2025-11-17 15:26:27', '2025-11-17 15:26:27', '2025-11-17 15:26:27');
INSERT INTO `transaction_list` VALUES ('250', '4', '1', '2025111723', '27476', '75', 'on lemp', 'none', 'monster king', '27476', '5800.00', '0.00', '0.00', '0', '5', '2025-11-17 15:31:46', '2025-11-17 15:31:46', '2025-11-17 15:31:46');
INSERT INTO `transaction_list` VALUES ('251', '4', '2', '2025111724', '27477', '76', 'Dead', 'none', 'smd kt 850', '27477', '300.00', '0.00', '0.00', '0', '5', '2025-11-17 15:46:41', '2025-11-17 15:46:41', '2025-11-17 15:46:41');
INSERT INTO `transaction_list` VALUES ('252', '4', '1', '2025111725', '27478', '77', 'Dead', 'none', 'par smps 33v', '27478', '250.00', '0.00', '0.00', '0', '5', '2025-11-17 18:40:45', '2025-11-17 18:40:45', '2025-11-17 18:40:45');
INSERT INTO `transaction_list` VALUES ('253', '4', '1', '2025111801', '27479', '80', 'Usb Short circuit', 'none', 'Plotter', '27479', '0.00', '0.00', '0.00', '0', '5', '2025-11-18 18:26:23', '2025-11-18 18:26:23', '2025-11-18 18:26:23');
INSERT INTO `transaction_list` VALUES ('254', '4', '1', '2025111802', '27480', '81', 'No Heat', '1 coil bhi di alag se', 'SMD red Ktools', '27480', '500.00', '0.00', '0.00', '0', '5', '2025-11-18 18:28:50', '2025-11-18 18:28:50', '2025-11-18 18:28:50');
INSERT INTO `transaction_list` VALUES ('255', '4', '1', '2025111803', '27481', '38', 'Dead', 'none', '5v 60a SMPS', '27481', '500.00', '0.00', '0.00', '0', '5', '2025-11-18 18:30:21', '2025-11-18 18:30:21', '2025-11-18 18:30:21');
INSERT INTO `transaction_list` VALUES ('256', '4', '1', '2025111804', '27482', '38', 'Dead', 'none', 'Processor LED wall', '27482', '1000.00', '0.00', '0.00', '0', '5', '2025-11-18 18:31:43', '2025-11-18 18:31:43', '2025-11-18 18:31:43');
INSERT INTO `transaction_list` VALUES ('257', '4', '1', '2025111805', '27483', '82', 'No out', 'Calble lagai h ', 'DMX 2000', '27483', '300.00', '0.00', '0.00', '0', '5', '2025-11-18 18:33:18', '2025-11-18 18:33:18', '2025-11-18 18:33:18');
INSERT INTO `transaction_list` VALUES ('258', '4', '1', '2025111806', '27484', '78', 'Dead', 'none', 'Mug Printing machine', '27484', '0.00', '0.00', '0.00', '0', '0', '2025-11-18 18:38:34', '2025-11-18 18:38:34', '');
INSERT INTO `transaction_list` VALUES ('259', '4', '1', '2025111807', '27485', '78', 'Dead', 'none', 'Mug Printing machine', '27485', '0.00', '0.00', '0.00', '0', '0', '2025-11-18 18:44:30', '2025-11-18 18:44:30', '');
INSERT INTO `transaction_list` VALUES ('260', '4', '1', '2025111808', '27486', '78', 'Dead', 'none', 'Mug Printing machine', '27486', '0.00', '0.00', '0.00', '0', '0', '2025-11-18 18:45:38', '2025-11-18 18:45:38', '');
INSERT INTO `transaction_list` VALUES ('261', '4', '1', '2025111901', '27487', '73', 'Dead', 'Temperature', 'Smok 2000', '27487', '300.00', '0.00', '0.00', '0', '5', '2025-11-19 14:01:44', '2025-11-19 14:01:44', '2025-11-19 14:01:44');
INSERT INTO `transaction_list` VALUES ('262', '4', '1', '2025111902', '27488', '73', 'Dead', 'Smps repair ', 'Smok 3000', '27488', '800.00', '0.00', '0.00', '0', '5', '2025-11-19 14:03:39', '2025-11-19 14:03:39', '2025-11-19 14:03:39');
INSERT INTO `transaction_list` VALUES ('263', '4', '1', '2025111903', '27489', '73', 'Dead', 'Tested ok', 'Smok 3000 spro', '27489', '0.00', '0.00', '0.00', '0', '5', '2025-11-19 14:05:16', '2025-11-19 14:05:16', '2025-11-19 14:05:16');
INSERT INTO `transaction_list` VALUES ('264', '4', '1', '2025111904', '27490', '73', 'Dead', 'Lamp high glow', 'follow spro', '27490', '3000.00', '0.00', '0.00', '0', '5', '2025-11-19 14:06:41', '2025-11-19 14:06:41', '2025-11-19 14:06:41');
INSERT INTO `transaction_list` VALUES ('265', '4', '2', '2025112101', '27491', '10', 'to be checked', 'none', 'Par Zenith', '27491', '0.00', '0.00', '0.00', '0', '0', '2025-11-21 12:50:45', '2025-11-21 12:50:45', '');
INSERT INTO `transaction_list` VALUES ('266', '4', '2', '2025112102', '27492', '10', 'to be checked', 'None', 'Par Zenith', '27492', '0.00', '0.00', '0.00', '0', '0', '2025-11-21 12:56:40', '2025-11-21 12:56:40', '');
INSERT INTO `transaction_list` VALUES ('267', '4', '2', '2025112103', '27493', '83', 'error', 'none', 'Sugon DC Machine', '27493', '0.00', '0.00', '0.00', '0', '5', '2025-11-21 12:57:28', '2026-01-11 15:29:12', '2026-01-11 15:29:12');
INSERT INTO `transaction_list` VALUES ('268', '4', '1', '2025112104', '27494', '84', 'Dead', 'none', '5v 60a SMPS', '27494', '500.00', '0.00', '0.00', '0', '5', '2025-11-21 12:58:47', '2025-11-21 12:58:47', '2025-11-21 12:58:47');
INSERT INTO `transaction_list` VALUES ('269', '4', '2', '2025112105', '27495', '84', 'Dead', 'none', '5v 60a SMPS', '27495', '500.00', '0.00', '0.00', '0', '5', '2025-11-21 13:00:16', '2025-11-21 13:00:16', '2025-11-21 13:00:16');
INSERT INTO `transaction_list` VALUES ('270', '4', '1', '2025112106', '27496', '85', 'Dead', 'none', '5v 60a SMPS', '27496', '500.00', '0.00', '0.00', '0', '5', '2025-11-21 13:01:33', '2025-11-21 13:01:33', '2025-11-21 13:01:33');
INSERT INTO `transaction_list` VALUES ('271', '4', '1', '2025112107', '27497', '85', 'Dead', 'none', '5v 60a SMPS', '27497', '500.00', '0.00', '0.00', '0', '5', '2025-11-21 13:02:22', '2025-11-21 13:02:22', '2025-11-21 13:02:22');
INSERT INTO `transaction_list` VALUES ('272', '4', '1', '2025112108', '27498', '85', 'Dead', 'none', '5v 60a SMPS', '27498', '500.00', '0.00', '0.00', '0', '5', '2025-11-21 13:03:01', '2025-11-21 13:03:01', '2025-11-21 13:03:01');
INSERT INTO `transaction_list` VALUES ('273', '4', '1', '2025112109', '27499', '85', 'Dead', 'None', '5v 60a SMPS', '27499', '500.00', '0.00', '0.00', '0', '5', '2025-11-21 13:03:49', '2025-11-21 13:03:49', '2025-11-21 13:03:49');
INSERT INTO `transaction_list` VALUES ('274', '4', '1', '2025112110', '27500', '85', 'Dead', 'none', '5v 60a SMPS', '27500', '500.00', '0.00', '0.00', '0', '5', '2025-11-21 13:13:31', '2025-11-21 13:13:31', '2025-11-21 13:13:31');
INSERT INTO `transaction_list` VALUES ('275', '4', '1', '2025112111', '27501', '85', 'Dead', 'none', '5v 60a SMPS', '27501', '500.00', '0.00', '0.00', '0', '5', '2025-11-21 13:24:03', '2025-11-21 13:24:03', '2025-11-21 13:24:03');
INSERT INTO `transaction_list` VALUES ('276', '4', '1', '2025112112', '27502', '85', 'Dead', 'none', '5v 60a SMPS', '27502', '500.00', '0.00', '0.00', '0', '5', '2025-11-21 13:26:43', '2025-11-21 13:26:43', '2025-11-21 13:26:43');
INSERT INTO `transaction_list` VALUES ('277', '4', '1', '2025112113', '27503', '85', 'Dead', 'none', '5v 60a SMPS', '27503', '0.00', '0.00', '0.00', '0', '0', '2025-11-21 13:27:22', '2025-11-21 13:27:22', '');
INSERT INTO `transaction_list` VALUES ('278', '4', '1', '2025112114', '27504', '85', 'Dead', 'nitin pal ko di 30/12/25', '5v 60a SMPS', '27504', '500.00', '0.00', '50.00', '0', '5', '2025-11-21 13:27:59', '2025-11-21 13:27:59', '2025-11-21 13:27:59');
INSERT INTO `transaction_list` VALUES ('279', '4', '2', '2025112115', '27505', '61', 'handlel', 'none', 'SMD Mechenic', '27505', '0.00', '0.00', '0.00', '0', '5', '2025-11-21 13:30:32', '2025-11-21 13:30:32', '2025-11-21 13:30:32');
INSERT INTO `transaction_list` VALUES ('280', '4', '1', '2025112116', '27506', '44', 'Dead', 'none', '5v 60a SMPS', 'B1', '500.00', '0.00', '50.00', '0', '2', '2025-11-21 13:31:24', '2026-01-02 18:26:46', '');
INSERT INTO `transaction_list` VALUES ('281', '4', '1', '2025112117', '27507', '44', 'Dead', 'none', '5v 60a SMPS', '27507', '0.00', '0.00', '0.00', '0', '0', '2025-11-21 13:32:14', '2025-11-21 13:32:14', '');
INSERT INTO `transaction_list` VALUES ('282', '4', '1', '2025112118', '27508', '44', 'Dead', 'none', '5v 60a SMPS', '27508', '0.00', '0.00', '0.00', '0', '0', '2025-11-21 13:32:59', '2025-11-21 13:32:59', '');
INSERT INTO `transaction_list` VALUES ('283', '4', '2', '2025112119', '27509', '20', 'Dead', 'none', 'Blinder 2 eye', '27509', '500.00', '0.00', '0.00', '0', '5', '2025-11-21 13:34:00', '2025-11-21 13:34:00', '2025-11-21 13:34:00');
INSERT INTO `transaction_list` VALUES ('284', '4', '2', '2025112120', '27510', '46', 'Lamp burst', 'None', 'Sharpy Stan 12R', '27510', '5600.00', '0.00', '0.00', '0', '5', '2025-11-21 14:35:28', '2025-11-21 14:35:28', '2025-11-21 14:35:28');
INSERT INTO `transaction_list` VALUES ('285', '4', '1', '2025112121', '27511', '68', 'dead', 'Sumit ko bhejne bola tanu ne', 'sparkle', '27511', '0.00', '0.00', '0.00', '0', '5', '2025-11-21 14:52:10', '2025-11-21 14:52:10', '2025-11-21 14:52:10');
INSERT INTO `transaction_list` VALUES ('286', '3', '', '2025112201', '27512', '88', 'lamp', 'igniter dala h , niche ka lock thik kiya h ', 'stan 10r axix', '27512', '0.00', '0.00', '0.00', '0', '5', '2025-11-22 15:51:46', '2025-11-22 15:51:46', '2025-11-22 15:51:46');
INSERT INTO `transaction_list` VALUES ('287', '3', '', '2025112202', '27513', '88', 'lamp', 'original lamp dala , side lock thik kiya', 'stan 12r ', '27513', '0.00', '0.00', '0.00', '0', '5', '2025-11-22 15:53:48', '2025-11-22 15:53:48', '2025-11-22 15:53:48');
INSERT INTO `transaction_list` VALUES ('288', '3', '1', '2025112203', '27514', '56', 'Dead', 'smps repair', 'DMX 240', '27514', '350.00', '0.00', '0.00', '0', '5', '2025-11-22 15:56:47', '2025-11-22 15:56:47', '2025-11-22 15:56:47');
INSERT INTO `transaction_list` VALUES ('289', '3', '', '2025112204', '27515', '89', 'remote', 'remote thik kiya', 'smoke z-1500', '27515', '300.00', '0.00', '0.00', '0', '5', '2025-11-22 16:01:09', '2025-11-22 16:01:09', '2025-11-22 16:01:09');
INSERT INTO `transaction_list` VALUES ('290', '3', '', '2025112205', '25516', '90', 'dead', 'return kr di usko ni banbana tha', 'smoke-1500', '25516', '0.00', '0.00', '0.00', '0', '5', '2025-11-22 16:05:14', '2025-11-22 16:05:14', '2025-11-22 16:05:14');
INSERT INTO `transaction_list` VALUES ('291', '3', '', '2025112206', '27517', '91', 'lock', 'lock thik kiya ', 'stan 650', '27517', '1500.00', '0.00', '0.00', '0', '5', '2025-11-22 16:08:28', '2025-11-22 16:08:28', '2025-11-22 16:08:28');
INSERT INTO `transaction_list` VALUES ('292', '3', '', '2025112207', '27518', '91', 'reset', 'sencer laga', 'stan 12r ', '27518', '1500.00', '0.00', '0.00', '0', '5', '2025-11-22 16:10:24', '2025-11-22 16:10:24', '2025-11-22 16:10:24');
INSERT INTO `transaction_list` VALUES ('293', '3', '', '2025112208', '27519', '92', 'lamp', 'igniter dala', '10r axix', '27519', '2500.00', '0.00', '0.00', '0', '5', '2025-11-22 16:13:24', '2025-11-22 16:13:24', '2025-11-22 16:13:24');
INSERT INTO `transaction_list` VALUES ('294', '3', '2', '2025112301', '24520', '93', 'lock', '9500 total 2 sharpy ka bill hai 4500 cash 5000 online', 'Sharpy Monsterking 650', '24520', '1500.00', '0.00', '0.00', '0', '5', '2025-11-22 21:47:52', '2025-11-22 21:47:52', '2025-11-22 21:47:52');
INSERT INTO `transaction_list` VALUES ('295', '3', '2', '2025112302', '27521', '93', 'No Lamp', 'ame as 27520', 'Sharpy Monsterking 650', '27521', '4500.00', '0.00', '0.00', '0', '5', '2025-11-22 21:51:43', '2025-11-22 21:51:43', '2025-11-22 21:51:43');
INSERT INTO `transaction_list` VALUES ('296', '3', '2', '2025112303', '27522', '94', 'Dead', 'Handle dala hai', 'SMD Rajshri', '27522', '900.00', '0.00', '0.00', '0', '5', '2025-11-22 21:54:37', '2025-11-22 21:54:37', '2025-11-22 21:54:37');
INSERT INTO `transaction_list` VALUES ('297', '3', '2', '2025112304', '27523', '94', 'Dead', 'Service', 'SMD Kt852D', '27523', '300.00', '0.00', '0.00', '0', '5', '2025-11-22 21:56:19', '2026-01-16 19:33:46', '2026-01-16 19:33:46');
INSERT INTO `transaction_list` VALUES ('298', '4', '1', '2025112401', '27524', '24', 'Dead', 'NONE', 'Sharpy 12R Stan', '27524', '1500.00', '0.00', '0.00', '0', '5', '2025-11-24 16:15:01', '2025-11-24 16:15:01', '2025-11-24 16:15:01');
INSERT INTO `transaction_list` VALUES ('299', '4', '1', '2025112402', '27525', '88', 'Lamp Burst', 'none', 'Sharpy 10R Axis', '27525', '3000.00', '0.00', '70.00', '0', '5', '2025-11-24 16:17:09', '2026-01-23 18:00:08', '2025-11-24 16:17:09');
INSERT INTO `transaction_list` VALUES ('300', '4', '1', '2025120301', '27526', '95', 'Dead', 'None', 'SMPS Par', '24/11/25', '250.00', '0.00', '0.00', '0', '2', '2025-12-03 10:55:04', '2025-12-06 15:31:40', '');
INSERT INTO `transaction_list` VALUES ('301', '4', '1', '2025120302', '27527', '95', 'Dead', 'None', 'SMPS Par', '24/11/25', '250.00', '0.00', '0.00', '0', '2', '2025-12-03 11:02:55', '2025-12-06 15:31:04', '');
INSERT INTO `transaction_list` VALUES ('302', '4', '1', '2025120303', '27528', '95', 'Dead', 'none', 'SMPS Par', '24/11/25', '250.00', '0.00', '0.00', '0', '2', '2025-12-03 11:06:23', '2025-12-07 17:18:42', '');
INSERT INTO `transaction_list` VALUES ('303', '4', '1', '2025120304', '27529', '95', 'Dead', 'none', 'SMPS Par', '24/11/25', '0.00', '0.00', '0.00', '0', '0', '2025-12-03 11:07:34', '2025-12-03 11:07:34', '');
INSERT INTO `transaction_list` VALUES ('304', '4', '1', '2025120305', '27530', '95', 'Dead', 'none', 'SMPS Par', '24/11/25', '0.00', '0.00', '0.00', '0', '0', '2025-12-03 11:09:02', '2025-12-03 11:09:02', '');
INSERT INTO `transaction_list` VALUES ('305', '4', '1', '2025120306', '27531', '10', 'Lamp Burst', '350w hi lagane bola shashank ne', 'monster king 600', '24/11/25', '3500.00', '0.00', '0.00', '0', '5', '2025-12-03 11:10:43', '2025-12-03 11:10:43', '2025-12-03 11:10:43');
INSERT INTO `transaction_list` VALUES ('306', '4', '1', '2025120307', '27532', '96', 'Hang', 'amit namdev ki 2 sharpy laye the dono checked and return and 1 sharpy amit ki mere pas se di', 'DMX 240', '24/11/25', '0.00', '0.00', '0.00', '0', '5', '2025-12-03 11:12:38', '2025-12-03 11:12:38', '2025-12-03 11:12:38');
INSERT INTO `transaction_list` VALUES ('307', '4', '1', '2025120308', '27533', '97', 'Dead', 'none', 'par 007', '24/11/25', '0.00', '0.00', '0.00', '0', '0', '2025-12-03 11:15:08', '2025-12-03 11:15:08', '');
INSERT INTO `transaction_list` VALUES ('308', '4', '1', '2025120309', '27534', '97', 'Dead', 'none', 'par 007', '24/11/25', '0.00', '0.00', '0.00', '0', '0', '2025-12-03 11:16:52', '2025-12-03 11:16:52', '');
INSERT INTO `transaction_list` VALUES ('309', '4', '1', '2025120310', '27535', '97', 'Only Testing', 'none', 'Sharpy 12R Stan', '24/11/25', '0.00', '0.00', '0.00', '0', '5', '2025-12-03 11:18:33', '2025-12-03 11:18:33', '2025-12-03 11:18:33');
INSERT INTO `transaction_list` VALUES ('310', '4', '1', '2025120311', '27536', '97', 'X Burnt', 'none', 'Sharpy 12R Stan', '24/11/25', '4500.00', '0.00', '0.00', '0', '5', '2025-12-03 11:26:43', '2025-12-03 11:26:43', '2025-12-03 11:26:43');
INSERT INTO `transaction_list` VALUES ('311', '4', '1', '2025120312', '27537', '98', 'no smoke', 'new heater and new thermostat', 'Fog- BD-1200', '25/11/25', '1200.00', '0.00', '0.00', '0', '5', '2025-12-03 11:32:35', '2025-12-03 11:32:35', '2025-12-03 11:32:35');
INSERT INTO `transaction_list` VALUES ('312', '4', '1', '2025120313', '27538', '2', 'Dead', 'none', '7 Eye Par', '25/11/25', '500.00', '0.00', '0.00', '0', '5', '2025-12-03 11:34:38', '2025-12-03 11:34:38', '2025-12-03 11:34:38');
INSERT INTO `transaction_list` VALUES ('313', '4', '1', '2025120314', '27539', '99', 'no smoke', 'none', 'Fog BPro 2000', '25/11/25', '0.00', '0.00', '0.00', '0', '5', '2025-12-03 11:37:15', '2025-12-03 11:37:15', '2025-12-03 11:37:15');
INSERT INTO `transaction_list` VALUES ('314', '4', '1', '2025120315', '27540', '100', 'Dead', 'None', 'Laptop Charger ', '03/12/25', '0.00', '0.00', '0.00', '0', '5', '2025-12-03 12:16:29', '2025-12-03 12:16:29', '2025-12-03 12:16:29');
INSERT INTO `transaction_list` VALUES ('315', '4', '1', '2025120316', '27541', '100', 'Dead', 'None', 'Komaki Charger 60v6a', '03/12/25', '0.00', '0.00', '0.00', '0', '5', '2025-12-03 12:18:29', '2025-12-03 12:18:29', '2025-12-03 12:18:29');
INSERT INTO `transaction_list` VALUES ('316', '4', '1', '2025120317', '27542', '101', 'dead', 'None', 'sharpy BSM Panther', '03/12/25', '0.00', '0.00', '0.00', '0', '5', '2025-12-03 13:05:59', '2025-12-03 13:05:59', '2025-12-03 13:05:59');
INSERT INTO `transaction_list` VALUES ('317', '4', '1', '2025120318', '27543', '101', 'Dead', 'None', 'retro fan', '03/12/25', '1500.00', '0.00', '150.00', '0', '5', '2025-12-03 13:07:30', '2026-01-27 20:30:55', '2026-01-27 20:30:00');
INSERT INTO `transaction_list` VALUES ('318', '4', '1', '2025120319', '27544', '101', 'dead', '3 x led 50w 175', '4eyes', '03/12/25', '700.00', '0.00', '0.00', '0', '5', '2025-12-03 13:08:44', '2025-12-03 13:08:44', '2025-12-03 13:08:44');
INSERT INTO `transaction_list` VALUES ('319', '4', '1', '2025120320', '27545', '101', 'dead', 'None', '4eyes ', '03/12/25', '500.00', '0.00', '0.00', '0', '5', '2025-12-03 13:09:52', '2025-12-03 13:09:52', '2025-12-03 13:09:52');
INSERT INTO `transaction_list` VALUES ('320', '4', '1', '2025120321', '27546', '102', 'dead', '7067395138
Abhishek choudhary', 'seperator machine ', '03/12/25', '500.00', '0.00', '50.00', '0', '5', '2025-12-03 14:31:10', '2025-12-03 14:31:10', '2025-12-03 14:31:10');
INSERT INTO `transaction_list` VALUES ('321', '4', '1', '2025120322', '27547', '103', 'Dead', 'none', 'Bubal machin', '27547', '500.00', '0.00', '0.00', '0', '5', '2025-12-03 15:11:18', '2025-12-03 15:11:18', '2025-12-03 15:11:18');
INSERT INTO `transaction_list` VALUES ('322', '4', '1', '2025120323', '27548', '105', 'Dead', 'none', 'Sharpy 12R Stan', '27548', '3000.00', '0.00', '0.00', '0', '5', '2025-12-03 15:50:36', '2025-12-03 15:50:36', '2025-12-03 15:50:36');
INSERT INTO `transaction_list` VALUES ('323', '4', '1', '2025120324', '27549', '106', 'dead', 'None', 'bubble machine dual', '03/12/25', '300.00', '0.00', '0.00', '0', '5', '2025-12-03 16:57:53', '2025-12-03 16:57:53', '2025-12-03 16:57:53');
INSERT INTO `transaction_list` VALUES ('324', '4', '1', '2025120325', '27550', '107', 'fader', 'None', 'DMX1024', '03/12/25', '300.00', '0.00', '0.00', '0', '5', '2025-12-03 19:25:53', '2025-12-03 19:25:53', '2025-12-03 19:25:53');
INSERT INTO `transaction_list` VALUES ('325', '4', '1', '2025120326', '27551', '108', 'side belt', 'None', 'sharpy stan 12r', '03/12/25', '500.00', '0.00', '0.00', '0', '5', '2025-12-03 19:34:20', '2025-12-03 19:34:20', '2025-12-03 19:34:20');
INSERT INTO `transaction_list` VALUES ('326', '4', '1', '2025120327', '27552', '17', 'gobo lance', 'None', 'Sharpy Stan 12r', '03/12/25', '2000.00', '0.00', '0.00', '0', '5', '2025-12-03 20:52:13', '2025-12-03 20:52:13', '2025-12-03 20:52:13');
INSERT INTO `transaction_list` VALUES ('327', '4', '1', '2025120401', '27553', '109', 'Dead', 'none', 'laptop charger lenovo', '04/12/25', '0.00', '0.00', '0.00', '0', '5', '2025-12-04 13:50:32', '2025-12-04 13:50:32', '2025-12-04 13:50:32');
INSERT INTO `transaction_list` VALUES ('328', '4', '1', '2025120402', '27554', '109', 'Dead', 'none', 'smps sparkel', '04/12/25', '0.00', '0.00', '0.00', '0', '5', '2025-12-04 13:58:50', '2025-12-04 13:58:50', '2025-12-04 13:58:50');
INSERT INTO `transaction_list` VALUES ('329', '4', '1', '2025120403', '27555', '110', 'not work properly', 'none', 'sharpy old black', '04/12/25', '300.00', '0.00', '0.00', '0', '5', '2025-12-04 14:01:52', '2025-12-04 14:01:52', '2025-12-04 14:01:52');
INSERT INTO `transaction_list` VALUES ('330', '4', '1', '2025120404', '27556', '110', 'Dead', 'none', 'SMPS Par', '04/12/25', '250.00', '0.00', '0.00', '0', '5', '2025-12-04 14:03:41', '2025-12-04 14:03:41', '2025-12-04 14:03:41');
INSERT INTO `transaction_list` VALUES ('331', '4', '1', '2025120405', '27557', '110', 'Dead', 'none', 'SMPS Par', '04/12/25', '250.00', '0.00', '0.00', '0', '5', '2025-12-04 14:04:20', '2025-12-04 14:04:20', '2025-12-04 14:04:20');
INSERT INTO `transaction_list` VALUES ('332', '4', '1', '2025120406', '27558', '65', 'no smoke', 'None', 'Bsm smok2000', '04/12/25', '900.00', '0.00', '0.00', '0', '5', '2025-12-04 15:22:13', '2025-12-04 15:22:13', '2025-12-04 15:22:13');
INSERT INTO `transaction_list` VALUES ('333', '4', '1', '2025120407', '27559', '85', 'Dead', 'none', '5v 60a SMPS', '03/12/25', '500.00', '0.00', '0.00', '0', '5', '2025-12-04 17:44:50', '2025-12-04 17:44:50', '2025-12-04 17:44:50');
INSERT INTO `transaction_list` VALUES ('334', '4', '1', '2025120408', '27560', '85', 'Dead', 'none', '5v 60a SMPS', '03/12/25', '500.00', '0.00', '0.00', '0', '5', '2025-12-04 17:45:24', '2025-12-04 17:45:24', '2025-12-04 17:45:24');
INSERT INTO `transaction_list` VALUES ('335', '4', '1', '2025120409', '27561', '85', 'Dead', 'none', '5v 60a SMPS', '04/12/25', '500.00', '0.00', '0.00', '0', '5', '2025-12-04 17:46:07', '2025-12-04 17:46:07', '2025-12-04 17:46:07');
INSERT INTO `transaction_list` VALUES ('336', '4', '1', '2025120410', '27562', '85', 'Dead', 'none', '5v 60a SMPS', '04/12/25', '500.00', '0.00', '0.00', '0', '5', '2025-12-04 17:46:49', '2025-12-04 17:46:49', '2025-12-04 17:46:49');
INSERT INTO `transaction_list` VALUES ('337', '4', '1', '2025120501', '27563', '85', 'Dead', 'None', 'Adapter', '05/12/25', '0.00', '0.00', '0.00', '0', '5', '2025-12-05 13:54:58', '2025-12-05 13:54:58', '2025-12-05 13:54:58');
INSERT INTO `transaction_list` VALUES ('338', '4', '1', '2025120502', '27564', '38', 'Dead', 'None', 'Processor LED wall', '05/12/25', '500.00', '0.00', '0.00', '0', '5', '2025-12-05 16:00:10', '2025-12-05 16:00:10', '2025-12-05 16:00:10');
INSERT INTO `transaction_list` VALUES ('339', '3', '', '2025120601', '27565', '66', 'Fedar ', '3 fedar', 'Dmx s-pro small', '06/12/2025', '300.00', '0.00', '0.00', '0', '5', '2025-12-06 16:27:51', '2025-12-06 16:27:51', '2025-12-06 16:27:51');
INSERT INTO `transaction_list` VALUES ('340', '3', '', '2025120602', '27566', '66', 'Batry wala bannna h ', 'None', 'Dmx ', '06/12/2025', '0.00', '0.00', '0.00', '0', '5', '2025-12-06 16:28:24', '2025-12-06 16:28:24', '2025-12-06 16:28:24');
INSERT INTO `transaction_list` VALUES ('341', '3', '2', '2025120603', '27567', '66', 'Khul gya h ', 'None', 'Co2 jet', '06/12/2025', '0.00', '0.00', '0.00', '0', '4', '2025-12-06 16:29:12', '2025-12-14 12:21:32', '');
INSERT INTO `transaction_list` VALUES ('342', '3', '1', '2025120604', '27568', '66', 'Heat  nhi ho rhi h ', 'Heater', 'Sparkle stan ', '06/12/2025', '1500.00', '0.00', '0.00', '0', '5', '2025-12-06 16:29:56', '2025-12-06 16:29:56', '2025-12-06 16:29:56');
INSERT INTO `transaction_list` VALUES ('343', '3', '', '2025120605', '27569', '66', 'Heating ', 'None', 'Bubble machine  wow', '06/12/2025', '1500.00', '0.00', '0.00', '0', '5', '2025-12-06 16:31:04', '2025-12-06 16:31:04', '2025-12-06 16:31:04');
INSERT INTO `transaction_list` VALUES ('344', '3', '2', '2025120606', '27570', '66', 'Down fan band h ', 'New Fan both and new supply', 'Bubble ', '06/12/2025', '2000.00', '0.00', '0.00', '0', '5', '2025-12-06 16:31:39', '2026-01-02 17:02:37', '');
INSERT INTO `transaction_list` VALUES ('345', '4', '1', '2025120607', '27571', '33', 'Dead', 'None', 'fog 3000 ste', '06/12/25', '1500.00', '0.00', '20.00', '0', '5', '2025-12-06 17:41:47', '2026-01-23 19:58:01', '2025-12-06 17:41:47');
INSERT INTO `transaction_list` VALUES ('346', '3', '', '2025120608', '27572', '33', 'Not Working', 'None', 'Dmx1024', '06/12/2025', '0.00', '0.00', '0.00', '0', '5', '2025-12-06 18:38:41', '2026-01-11 15:26:11', '2026-01-11 15:26:11');
INSERT INTO `transaction_list` VALUES ('347', '3', '', '2025120609', '27573', '19', 'Dead', 'Pump 18w ka dala h ', 'Smoke mchine jia 1500w', '06/12/2025', '700.00', '0.00', '0.00', '0', '5', '2025-12-06 18:39:30', '2025-12-06 18:39:30', '2025-12-06 18:39:30');
INSERT INTO `transaction_list` VALUES ('348', '3', '', '2025120610', '27574', '19', 'dead', 'None', 'Smoke b pro z200w', '06/12/2025', '600.00', '0.00', '0.00', '0', '5', '2025-12-06 18:40:54', '2025-12-06 18:40:54', '2025-12-06 18:40:54');
INSERT INTO `transaction_list` VALUES ('349', '3', '', '2025120611', '27575', '19', 'dead', 'None', 'Smoke bsm strom', '06/12/2025', '900.00', '0.00', '0.00', '0', '5', '2025-12-06 18:41:26', '2025-12-06 18:41:26', '2025-12-06 18:41:26');
INSERT INTO `transaction_list` VALUES ('350', '3', '', '2025120701', '27576', '113', 'Air ni aa rhi h ', 'Green', 'Smd hiko', '07/12/2025', '350.00', '0.00', '0.00', '0', '5', '2025-12-07 14:17:06', '2025-12-07 14:17:06', '2025-12-07 14:17:06');
INSERT INTO `transaction_list` VALUES ('351', '4', '1', '2025120702', '27577', '114', 'Dead', 'Khuli aayi hai', 'DC machine APS1502', '04/12/25', '300.00', '0.00', '0.00', '0', '5', '2025-12-07 15:21:11', '2025-12-07 15:21:11', '2025-12-07 15:21:11');
INSERT INTO `transaction_list` VALUES ('352', '3', '', '2025120703', '27578', '115', 'Smoke nhi aa rha h ', 'None', 'Smoke bd 1200w', '07/12/2025', '200.00', '0.00', '0.00', '0', '5', '2025-12-07 15:51:48', '2025-12-07 15:51:48', '2025-12-07 15:51:48');
INSERT INTO `transaction_list` VALUES ('353', '3', '1', '2025120704', '27579', '76', 'Dead', 'Neeche naam n. Likha h ', 'Smd quick kt 850A+ silver ', '07/12/2025', '0.00', '0.00', '0.00', '0', '5', '2025-12-07 19:42:56', '2026-01-11 18:47:40', '2026-01-11 18:47:40');
INSERT INTO `transaction_list` VALUES ('354', '3', '', '2025120901', '27580', '83', 'dead', 'None', 'Tv smps', '09/12/2025', '250.00', '0.00', '0.00', '0', '5', '2025-12-09 12:37:15', '2025-12-09 12:37:15', '2025-12-09 12:37:15');
INSERT INTO `transaction_list` VALUES ('355', '3', '', '2025120902', '27581', '118', 'Fedar', '9 feadar lage hai.... ', 'Dmx512', '09/12/2025', '900.00', '0.00', '0.00', '0', '5', '2025-12-09 14:09:20', '2025-12-09 14:09:20', '2025-12-09 14:09:20');
INSERT INTO `transaction_list` VALUES ('356', '3', '', '2025120903', '27582', '118', 'Output nhi aa rha h ', 'None', 'Dmx 512 bsm', '09/12/2025', '300.00', '0.00', '0.00', '0', '5', '2025-12-09 14:09:58', '2025-12-09 14:09:58', '2025-12-09 14:09:58');
INSERT INTO `transaction_list` VALUES ('357', '3', '2', '2025120904', '27583', '119', 'Fedar ', 'None', 'Dmx240', '09/12/2025', '250.00', '0.00', '0.00', '0', '5', '2025-12-09 20:21:27', '2025-12-09 20:21:27', '2025-12-09 20:21:27');
INSERT INTO `transaction_list` VALUES ('358', '3', '', '2025120905', '27584', '119', 'Dead', 'Fedar laga h ek smps repair hui hai', 'Dmx240 disco red in black', '09/12/2025', '500.00', '0.00', '0.00', '0', '5', '2025-12-09 20:22:19', '2025-12-09 20:22:19', '2025-12-09 20:22:19');
INSERT INTO `transaction_list` VALUES ('359', '3', '', '2025121001', '27585', '120', 'Patch button not working', 'None', 'Dmx1024', '10/12/2025', '800.00', '0.00', '0.00', '0', '5', '2025-12-10 12:15:41', '2025-12-10 12:15:41', '2025-12-10 12:15:41');
INSERT INTO `transaction_list` VALUES ('360', '3', '', '2025121002', '27586', '121', 'Handle', 'Handle laga h 
Pcb me kam hua h ', 'Smd quick 850a', '10/12/2025', '700.00', '0.00', '0.00', '0', '5', '2025-12-10 15:04:00', '2025-12-10 15:04:00', '2025-12-10 15:04:00');
INSERT INTO `transaction_list` VALUES ('361', '4', '1', '2025121003', '27587', '122', 'Lock Broken ', 'None', 'Sharpy  BSM Beast ', '10/12/25', '1500.00', '0.00', '0.00', '0', '5', '2025-12-10 17:42:28', '2025-12-10 17:42:28', '2025-12-10 17:42:28');
INSERT INTO `transaction_list` VALUES ('362', '4', '1', '2025121004', '27588', '124', 'dead', 'sandeep ke dost', 'gem filer machine', '10/12/25', '300.00', '0.00', '30.00', '0', '2', '2025-12-10 21:23:20', '2025-12-29 16:36:08', '');
INSERT INTO `transaction_list` VALUES ('363', '4', '1', '2025121005', '27589', '119', 'Y screw ', 'none', 'Sharpy 12R Stan', '10/12/25', '1500.00', '0.00', '0.00', '0', '5', '2025-12-10 21:30:05', '2025-12-10 21:30:05', '2025-12-10 21:30:05');
INSERT INTO `transaction_list` VALUES ('364', '3', '1', '2025121101', '27590', '61', 'Dead', 'None', 'Lcd ', '11/12/2025', '0.00', '0.00', '0.00', '0', '0', '2025-12-11 18:49:35', '2025-12-11 21:19:24', '');
INSERT INTO `transaction_list` VALUES ('365', '4', '1', '2025121102', '27591', '2', 'Display Loos', 'none', 'DMX Tiger Touch', '11/12/25', '0.00', '0.00', '0.00', '0', '5', '2025-12-11 20:58:20', '2025-12-11 20:58:20', '2025-12-11 20:58:20');
INSERT INTO `transaction_list` VALUES ('366', '4', '1', '2025121103', '27592', '2', 'Dmx Code Change', 'none', 'Profile Light', '11/12/25', '0.00', '0.00', '0.00', '0', '5', '2025-12-11 20:59:29', '2025-12-11 20:59:29', '2025-12-11 20:59:29');
INSERT INTO `transaction_list` VALUES ('367', '3', '2', '2025121201', '27593', '129', 'Card', 'None', 'Stan 12r', '12/12/2025', '2000.00', '0.00', '0.00', '0', '5', '2025-12-12 15:21:37', '2025-12-12 15:21:37', '2025-12-12 15:21:37');
INSERT INTO `transaction_list` VALUES ('368', '3', '1', '2025121202', '27594', '129', 'Display', 'New Lamp 300w philips and new display 10r', '10r yellow', '12/12/2025', '6000.00', '0.00', '0.00', '0', '5', '2025-12-12 15:22:20', '2025-12-12 15:22:20', '2025-12-12 15:22:20');
INSERT INTO `transaction_list` VALUES ('369', '4', '1', '2025121203', '27595', '130', 'Dead', 'None', 'smps chair massage ', '12/12/25', '600.00', '0.00', '0.00', '0', '5', '2025-12-12 17:19:23', '2025-12-12 17:19:23', '2025-12-12 17:19:23');
INSERT INTO `transaction_list` VALUES ('370', '3', '1', '2025121301', '27596', '131', 'Head dikkt me hai', 'None', 'Ploter', '13/12/2025', '0.00', '0.00', '0.00', '0', '5', '2025-12-13 13:23:22', '2026-01-25 20:00:22', '2025-12-13 14:54:00');
INSERT INTO `transaction_list` VALUES ('371', '4', '2', '2025121302', '27597', '132', 'tooti ', 'Non', 'sharpy BSM penther', '13/12/2025', '1500.00', '0.00', '0.00', '0', '5', '2025-12-13 18:33:23', '2025-12-13 18:33:23', '2025-12-13 18:33:23');
INSERT INTO `transaction_list` VALUES ('372', '4', '1', '2025121303', '27598', '22', 'Dead', 'None', 'Sharpy smps', '13/12/2025', '800.00', '0.00', '0.00', '0', '5', '2025-12-13 22:57:36', '2025-12-13 22:57:36', '2025-12-13 22:57:36');
INSERT INTO `transaction_list` VALUES ('373', '4', '1', '2025121304', '27599', '22', 'Blink', 'None', '4 eyes money light', '13/12/2025', '300.00', '0.00', '0.00', '0', '5', '2025-12-13 22:59:06', '2025-12-13 22:59:06', '2025-12-13 22:59:06');
INSERT INTO `transaction_list` VALUES ('374', '4', '1', '2025121305', '27600', '22', 'Some led broken', 'None', 'Bsm batton mibar', '13/12/2025', '500.00', '0.00', '0.00', '0', '5', '2025-12-13 23:00:38', '2025-12-13 23:00:38', '2025-12-13 23:00:38');
INSERT INTO `transaction_list` VALUES ('375', '4', '1', '2025121401', '27601', '133', 'x belt ', 'Belt 351 new', 'Sharpy Stan 10r axis ', '14/12/25', '1500.00', '0.00', '0.00', '0', '5', '2025-12-14 11:18:33', '2025-12-14 11:18:33', '2025-12-14 11:18:33');
INSERT INTO `transaction_list` VALUES ('376', '4', '1', '2025121402', '27602', '75', 'Kamp Blasted', 'None', 'sharp Stan 12r', '14/12/25', '4000.00', '0.00', '0.00', '0', '5', '2025-12-14 19:16:40', '2025-12-14 19:16:40', '2025-12-14 19:16:40');
INSERT INTO `transaction_list` VALUES ('377', '4', '2', '2025121403', '27603', '75', 'no lamp', 'None', 'Sharpy Stan 12r', '14/12/25', '4000.00', '0.00', '0.00', '0', '5', '2025-12-14 19:18:35', '2025-12-14 19:18:35', '2025-12-14 19:18:35');
INSERT INTO `transaction_list` VALUES ('378', '4', '2', '2025121404', '27604', '119', 'Dead', 'None', 'smps laser', '14/12/25', '300.00', '0.00', '0.00', '0', '5', '2025-12-14 19:19:28', '2025-12-14 19:19:28', '2025-12-14 19:19:28');
INSERT INTO `transaction_list` VALUES ('379', '4', '1', '2025121405', '27605', '119', 'bend', 'None', 'Stan mi bar', '14/12/25', '800.00', '0.00', '80.00', '0', '5', '2025-12-14 19:20:42', '2026-01-20 15:21:05', '2026-01-20 15:21:05');
INSERT INTO `transaction_list` VALUES ('380', '4', '2', '2025121501', '27606', '135', 'Dead', 'new supply di thi par wo kharab ho gai thi repair  ki hai', 'Sharpy 10R Yellow', '27/11/25', '800.00', '0.00', '0.00', '0', '5', '2025-12-15 12:18:15', '2025-12-15 12:18:15', '2025-12-15 12:18:15');
INSERT INTO `transaction_list` VALUES ('381', '3', '', '2025121502', '27607', '19', 'Dead', 'Saman doosri sharphy ka lgaye h 
Smps ... Card', 'Saif sharpy ', '15/12/2025', '1000.00', '0.00', '0.00', '0', '5', '2025-12-15 12:39:51', '2025-12-15 12:39:51', '2025-12-15 12:39:51');
INSERT INTO `transaction_list` VALUES ('382', '3', '2', '2025121503', '27608', '19', 'Dead', 'Body toori thi bo seedhi ki 
Q fan dala h ', 'Saif sharpy', '15/12/2025', '1500.00', '0.00', '0.00', '0', '5', '2025-12-15 12:40:35', '2025-12-15 12:40:35', '2025-12-15 12:40:35');
INSERT INTO `transaction_list` VALUES ('383', '3', '2', '2025121504', '27609', '19', 'Dead', 'Doosri ka saman lga tha', 'Saif sharpy', '15/12/2025', '500.00', '0.00', '0.00', '0', '5', '2025-12-15 12:41:24', '2025-12-15 12:41:24', '2025-12-15 12:41:24');
INSERT INTO `transaction_list` VALUES ('384', '3', '2', '2025121505', '27610', '19', 'Dead', '3 fan .. igniter... Smps repair.... Body thik ki 
Iska focas or shutter band hai', 'Saif sharpy', '15/12/2025', '3400.00', '0.00', '0.00', '0', '5', '2025-12-15 12:42:01', '2025-12-15 12:42:01', '2025-12-15 12:42:01');
INSERT INTO `transaction_list` VALUES ('385', '3', '', '2025121506', '27611', '136', 'Dead', 'None', 'Laser small ', '15/12/2025', '700.00', '0.00', '0.00', '0', '2', '2025-12-15 18:14:46', '2025-12-18 17:09:24', '');
INSERT INTO `transaction_list` VALUES ('386', '3', '2', '2025121507', '27612', '119', 'Dead', 'None', 'Par smps ', '15/12/2025', '250.00', '0.00', '0.00', '0', '5', '2025-12-15 20:28:48', '2025-12-15 20:28:48', '2025-12-15 20:28:48');
INSERT INTO `transaction_list` VALUES ('387', '3', '', '2025121508', '27613', '119', 'Dead', 'None', 'Par smps ', '15/12/2025', '250.00', '0.00', '0.00', '0', '5', '2025-12-15 20:29:15', '2025-12-15 20:29:15', '2025-12-15 20:29:15');
INSERT INTO `transaction_list` VALUES ('398', '3', '2', '2025121701', '27614', '137', 'Dead', 'None', 'Seprater kt888pro+', '17/12/2025', '400.00', '0.00', '0.00', '0', '5', '2025-12-17 15:28:09', '2025-12-17 15:28:09', '2025-12-17 15:28:09');
INSERT INTO `transaction_list` VALUES ('399', '4', '1', '2025121801', '27615', '40', 'dead', 'None', '5v 60 a smps', 'B1', '500.00', '0.00', '50.00', '0', '2', '2025-12-18 16:08:51', '2026-01-02 15:16:16', '');
INSERT INTO `transaction_list` VALUES ('400', '4', '1', '2025121802', '27616', '40', 'dead', 'None', '5v 60a smps', 'B1', '500.00', '0.00', '50.00', '0', '2', '2025-12-18 16:10:25', '2026-01-02 15:15:56', '');
INSERT INTO `transaction_list` VALUES ('401', '4', '1', '2025121901', '27617', '109', 'dead', 'None ', 'SMPS 24V', '19/12/25', '250.00', '0.00', '0.00', '0', '5', '2025-12-19 12:46:28', '2025-12-19 12:46:28', '2025-12-19 12:46:28');
INSERT INTO `transaction_list` VALUES ('402', '4', '1', '2025121902', '27618', '109', 'dead', 'None', 'SMPS 5v 20a slim', '19/12/25', '250.00', '0.00', '0.00', '0', '5', '2025-12-19 12:47:50', '2025-12-19 12:47:50', '2025-12-19 12:47:50');
INSERT INTO `transaction_list` VALUES ('403', '4', '1', '2025121903', '27619', '138', 'Dead ', 'None ', 'SMPS 5V24A SLIM', '19/12/25', '250.00', '0.00', '0.00', '0', '5', '2025-12-19 13:52:26', '2025-12-19 13:52:26', '2025-12-19 13:52:26');
INSERT INTO `transaction_list` VALUES ('404', '4', '1', '2025121904', '27620', '138', 'Dead ', 'None ', 'SMPS 5V24A SLIM', '19/12/25', '250.00', '0.00', '0.00', '0', '5', '2025-12-19 13:54:23', '2025-12-19 13:54:23', '2025-12-19 13:54:23');
INSERT INTO `transaction_list` VALUES ('405', '4', '1', '2025121905', '27621', '138', 'Dead ', 'None ', 'SMPS 36/12/200', '19/12/25', '250.00', '0.00', '0.00', '0', '5', '2025-12-19 13:56:04', '2025-12-19 13:56:04', '2025-12-19 13:56:04');
INSERT INTO `transaction_list` VALUES ('406', '4', '1', '2025121906', '27322', '138', 'Dead', 'None ', 'igniter12r', '19/12/25', '0.00', '0.00', '0.00', '0', '4', '2025-12-19 13:58:30', '2026-01-11 15:25:09', '');
INSERT INTO `transaction_list` VALUES ('407', '4', '1', '2025121907', '27623', '138', 'Dead ', 'None ', 'igniter12r ', '19/12/25', '0.00', '0.00', '0.00', '0', '4', '2025-12-19 13:59:59', '2026-01-11 15:24:57', '');
INSERT INTO `transaction_list` VALUES ('408', '4', '1', '2025121908', '27624', '139', 'dead', '9644492526 manoj srinagar ', 'SMD KT950 AC+', '19/12/2025', '0.00', '0.00', '0.00', '0', '0', '2025-12-19 15:53:02', '2025-12-19 18:44:16', '');
INSERT INTO `transaction_list` VALUES ('412', '4', '1', '2025122001', '27625', '141', 'Dead', 'none', 'Induction heater', '20/12/25', '200.00', '0.00', '0.00', '0', '5', '2025-12-20 14:56:24', '2025-12-20 14:56:24', '2025-12-20 14:56:24');
INSERT INTO `transaction_list` VALUES ('413', '4', '1', '2025122101', '27626', '140', 'Dead', 'None', 'ww blinders 2 eye', 'Raipur', '0.00', '0.00', '0.00', '0', '0', '2025-12-21 12:48:37', '2026-01-04 17:15:56', '');
INSERT INTO `transaction_list` VALUES ('414', '4', '2', '2025122102', '27627', '140', 'dead', 'Display nahi aaya h. Smps bhi nhi aai h neelesh bhai de kar gaye 17/01/26
Smps repair kiye h ', 'blinder 2 eyes', 'Raipur', '500.00', '0.00', '0.00', '0', '2', '2025-12-21 12:51:39', '2026-01-20 14:39:28', '');
INSERT INTO `transaction_list` VALUES ('415', '4', '2', '2025122103', '27628', '140', 'dead', 'None', 'strob  RGB 1000w', 'Raipur', '0.00', '0.00', '0.00', '0', '0', '2025-12-21 12:53:06', '2026-01-04 17:15:20', '');
INSERT INTO `transaction_list` VALUES ('416', '4', '1', '2025122104', '27629', '140', 'dea', 'None', 'RGB strobe 1000w', 'Raipur', '0.00', '0.00', '0.00', '0', '0', '2025-12-21 12:54:46', '2026-01-04 17:15:03', '');
INSERT INTO `transaction_list` VALUES ('417', '4', '2', '2025122105', '24630', '140', 'dead', 'None', 'RGB strobe 1000w', 'Raipur', '0.00', '0.00', '0.00', '0', '0', '2025-12-21 12:55:54', '2026-01-04 17:14:46', '');
INSERT INTO `transaction_list` VALUES ('418', '4', '2', '2025122106', '27631', '140', 'dead', 'None', 'RGB strobe 1000w', 'Raipur', '0.00', '0.00', '0.00', '0', '0', '2025-12-21 12:56:59', '2026-01-04 17:14:09', '');
INSERT INTO `transaction_list` VALUES ('419', '4', '2', '2025122107', '27632', '140', 'dead', 'None', 'RGB strobe 1000w', 'Raipur', '0.00', '0.00', '0.00', '0', '0', '2025-12-21 12:57:43', '2026-01-04 17:13:51', '');
INSERT INTO `transaction_list` VALUES ('420', '4', '2', '2025122108', '27633', '140', 'dead', 'None', 'RGB strobe 1000w', 'Raipur', '0.00', '0.00', '0.00', '0', '0', '2025-12-21 12:58:42', '2026-01-04 17:13:29', '');
INSERT INTO `transaction_list` VALUES ('421', '3', '2', '2025122109', '27634', '140', 'Fuse uda rhi h ', 'None', 'Sharpy  deftech pro 300', 'jabalpur', '850.00', '0.00', '0.00', '0', '5', '2025-12-21 13:22:18', '2026-01-04 17:16:41', '2025-12-21 13:22:18');
INSERT INTO `transaction_list` VALUES ('435', '4', '1', '2025122110', '27635', '20', 'Dead', '', 'Sharpy Stan 12R', '21/12/25', '1500.00', '0.00', '0.00', '0', '5', '2025-12-21 14:44:55', '2025-12-21 14:44:55', '2025-12-21 14:44:55');
INSERT INTO `transaction_list` VALUES ('436', '4', '1', '2025122111', '27636', '20', 'Dead', '', 'Sharpy Stan 12R', '21/12/25', '1500.00', '0.00', '0.00', '0', '5', '2025-12-21 14:44:55', '2025-12-21 14:44:55', '2025-12-21 14:44:55');
INSERT INTO `transaction_list` VALUES ('439', '5', '1', '2025122301', '27637', '101', 'Dead', 'None', 'Strob Rgb spro', '22-12-25', '400.00', '0.00', '0.00', '0', '5', '2025-12-23 14:23:34', '2025-12-23 14:23:34', '2025-12-23 14:23:34');
INSERT INTO `transaction_list` VALUES ('440', '5', '2', '2025122302', '27638', '101', 'Dead', '', 'igniter 295 bsm', '22-12-25', '0.00', '0.00', '0.00', '0', '5', '2025-12-23 14:25:43', '2025-12-23 14:25:43', '2025-12-23 14:25:43');
INSERT INTO `transaction_list` VALUES ('441', '5', '1', '2025122303', '27639', '101', 'Dead', '', 'igniter 295 bsm', '22-12-25', '0.00', '0.00', '0.00', '0', '5', '2025-12-23 14:26:41', '2025-12-23 14:26:41', '2025-12-23 14:26:41');
INSERT INTO `transaction_list` VALUES ('442', '5', '2', '2025122304', '27640', '142', 'broke and motor jam ', '', 'bsm beast sharpy', '22-12-25', '0.00', '0.00', '0.00', '0', '5', '2025-12-23 14:31:04', '2025-12-23 14:31:04', '2025-12-23 14:31:04');
INSERT INTO `transaction_list` VALUES ('443', '5', '2', '2025122305', '27641', '142', 'Xlr B not working', '', 'dmx 1024 ritz', '22-12-25', '800.00', '0.00', '0.00', '0', '5', '2025-12-23 14:32:21', '2025-12-23 14:32:21', '2025-12-23 14:32:21');
INSERT INTO `transaction_list` VALUES ('444', '5', '1', '2025122306', '27642', '143', 'mall functions', '', 'dmx 1024', '22-12-25', '3500.00', '0.00', '0.00', '0', '5', '2025-12-23 14:37:21', '2025-12-23 14:37:21', '2025-12-23 14:37:21');
INSERT INTO `transaction_list` VALUES ('445', '5', '1', '2025122307', '27643', '40', 'Dead', '', 'led wall smps ', '22-12-25', '500.00', '0.00', '50.00', '0', '5', '2025-12-23 14:38:24', '2025-12-23 14:38:24', '2025-12-23 14:38:24');
INSERT INTO `transaction_list` VALUES ('446', '5', '1', '2025122308', '27644', '40', 'Dead', '', 'led wall smps ', '22-12-25', '500.00', '0.00', '50.00', '0', '5', '2025-12-23 14:39:35', '2025-12-23 14:39:35', '2025-12-23 14:39:35');
INSERT INTO `transaction_list` VALUES ('447', '5', '1', '2025122309', '27645', '40', 'Dead', '', 'led wall smps ', '22-12-25', '500.00', '0.00', '50.00', '0', '5', '2025-12-23 14:40:17', '2025-12-23 14:40:17', '2025-12-23 14:40:17');
INSERT INTO `transaction_list` VALUES ('448', '5', '1', '2025122310', '27646', '40', 'Dead', '', 'led wall smps ', '22-12-25', '500.00', '0.00', '50.00', '0', '5', '2025-12-23 14:41:06', '2025-12-23 14:41:06', '2025-12-23 14:41:06');
INSERT INTO `transaction_list` VALUES ('449', '5', '1', '2025122311', '27647', '40', 'Dead', '', 'led wall smps ', '22-12-25', '500.00', '0.00', '50.00', '0', '5', '2025-12-23 14:41:39', '2025-12-23 14:41:39', '2025-12-23 14:41:39');
INSERT INTO `transaction_list` VALUES ('450', '5', '1', '2025122312', '27648', '40', 'Dead', '', 'led wall smps ', '22-12-25', '500.00', '0.00', '0.00', '0', '5', '2025-12-23 14:42:26', '2025-12-23 14:42:26', '2025-12-23 14:42:26');
INSERT INTO `transaction_list` VALUES ('451', '3', '2', '2025122313', '27649', '109', 'Dead', '', 'Sharpy smps ', '23//12/2025', '500.00', '0.00', '0.00', '0', '5', '2025-12-23 15:19:23', '2025-12-23 15:19:23', '2025-12-23 15:19:23');
INSERT INTO `transaction_list` VALUES ('452', '4', '1', '2025122314', '27650', '109', 'eNcoder broken ', 'None', 'laserStan', '', '500.00', '0.00', '23.00', '0', '5', '2025-12-23 18:34:27', '2025-12-23 18:34:27', '2025-12-23 18:34:27');
INSERT INTO `transaction_list` VALUES ('453', '4', '1', '2025122315', '27651', '109', 'software', 'None ', 'laser 3w', '23/12/25', '500.00', '0.00', '50.00', '0', '5', '2025-12-23 18:36:14', '2026-01-28 17:03:51', '2026-01-12 13:09:01');
INSERT INTO `transaction_list` VALUES ('458', '3', '2', '2025122401', '27652', '144', 'Dead', '', 'Sharpy 10r yellow ', '24/12/2025', '1500.00', '0.00', '0.00', '0', '5', '2025-12-24 14:32:50', '2025-12-24 14:32:50', '2025-12-24 14:32:50');
INSERT INTO `transaction_list` VALUES ('459', '3', '2', '2025122402', '27653', '144', 'Dead', '', '10r yellow', '24/12/2025', '3000.00', '0.00', '0.00', '0', '5', '2025-12-24 14:33:18', '2025-12-24 14:33:18', '2025-12-24 14:33:18');
INSERT INTO `transaction_list` VALUES ('460', '3', '2', '2025122403', '27654', '144', 'Dead', '', '10r yellow', '24/12/2025', '3000.00', '0.00', '0.00', '0', '5', '2025-12-24 14:33:39', '2025-12-24 14:33:39', '2025-12-24 14:33:39');
INSERT INTO `transaction_list` VALUES ('461', '3', '2', '2025122404', '27655', '144', 'Dead', '', '240 mixer ', '24/12/2025', '300.00', '0.00', '0.00', '0', '2', '2025-12-24 14:34:05', '2025-12-24 19:37:56', '');
INSERT INTO `transaction_list` VALUES ('462', '3', '2', '2025122405', '27656', '144', 'Dead', '', '240 dmx ', '24/12/2025', '1200.00', '0.00', '0.00', '0', '5', '2025-12-24 14:34:26', '2025-12-24 14:34:26', '2025-12-24 14:34:26');
INSERT INTO `transaction_list` VALUES ('463', '3', '2', '2025122406', '27657', '144', 'Dead', '', 'Smoke b pro 2000wt', '24/12/2025', '300.00', '0.00', '0.00', '0', '5', '2025-12-24 14:34:48', '2025-12-24 14:34:48', '2025-12-24 14:34:48');
INSERT INTO `transaction_list` VALUES ('464', '3', '2', '2025122407', '27658', '65', 'Dead', 'New fan, new Lamp 350, new igniter 350, pfc repair ', 'Sharpy  stan 15r ', '24/12/2025', '8000.00', '0.00', '0.00', '0', '2', '2025-12-24 14:46:37', '2025-12-31 14:13:55', '');
INSERT INTO `transaction_list` VALUES ('465', '3', '2', '2025122408', '27659', '65', 'Dead', 'Smps repair', 'Sharpy stan 15r', '24/12/2025', '1500.00', '0.00', '0.00', '0', '5', '2025-12-24 14:47:06', '2025-12-24 14:47:06', '2025-12-24 14:47:06');
INSERT INTO `transaction_list` VALUES ('466', '3', '2', '2025122409', '27660', '65', 'Dead', '', 'Atomic bsm', '24/12/2025', '500.00', '0.00', '0.00', '0', '5', '2025-12-24 14:47:32', '2025-12-24 14:47:32', '2025-12-24 14:47:32');
INSERT INTO `transaction_list` VALUES ('467', '3', '2', '2025122410', '27661', '65', 'Dead', '', 'Atomic bsm ', '24/12/2025', '500.00', '0.00', '0.00', '0', '2', '2025-12-24 14:47:59', '2025-12-31 14:42:12', '');
INSERT INTO `transaction_list` VALUES ('468', '3', '2', '2025122411', '27662', '65', 'Dead', '', 'Mi bar ', '24/12/2025', '0.00', '0.00', '0.00', '0', '0', '2025-12-24 14:48:41', '2025-12-24 14:48:41', '');
INSERT INTO `transaction_list` VALUES ('469', '3', '2', '2025122412', '27663', '65', 'Dead', '', 'Splitter stan 512mx 8 way pro', '24/12/2025', '0.00', '0.00', '0.00', '0', '5', '2025-12-24 14:49:20', '2025-12-24 14:49:20', '2025-12-24 14:49:20');
INSERT INTO `transaction_list` VALUES ('470', '3', '1', '2025122413', '27664', '145', 'Dead', '', 'Seperator kooku 999', '24/12/2025', '500.00', '0.00', '50.00', '0', '2', '2025-12-24 15:05:07', '2025-12-26 11:32:05', '');
INSERT INTO `transaction_list` VALUES ('472', '3', '1', '2025122501', '27665', '148', 'Heat', '', 'Mechanic smd 857Dw', '25/12/2025', '350.00', '0.00', '15.00', '0', '5', '2025-12-25 13:45:47', '2025-12-25 13:45:47', '2025-12-25 13:45:47');
INSERT INTO `transaction_list` VALUES ('473', '3', '1', '2025122502', '27666', '140', 'Dead', '', 'Splitter8', 'Raipur', '0.00', '0.00', '0.00', '0', '0', '2025-12-25 16:58:01', '2026-01-04 17:12:48', '');
INSERT INTO `transaction_list` VALUES ('475', '4', '1', '2025122601', '27667', '118', 'No Lamp', 'None', 'Sharpy 10R Yellow', '26/12/25', '3000.00', '0.00', '50.00', '0', '2', '2025-12-26 11:31:19', '2025-12-26 13:06:07', '');
INSERT INTO `transaction_list` VALUES ('491', '4', '1', '2025122602', '27668', '101', 'Only fro Compare', 'none', 'Retro Fan', '26/12/25', '0.00', '0.00', '0.00', '0', '5', '2025-12-26 15:05:12', '2026-01-27 20:30:28', '2026-01-27 20:30:00');
INSERT INTO `transaction_list` VALUES ('492', '4', '1', '2025122603', '27669', '101', 'Dead', 'none', 'Laser Long 4 haed', '26/12/25', '0.00', '0.00', '0.00', '0', '0', '2025-12-26 15:05:59', '2025-12-26 15:05:59', '');
INSERT INTO `transaction_list` VALUES ('493', '4', '1', '2025122604', '27670', '149', 'Lamp Problem', 'Display repair sencer repair ', 'Sharpy Spro 15r', '26/12/25', '1500.00', '0.00', '150.00', '0', '5', '2025-12-26 15:07:59', '2025-12-26 15:07:59', '2025-12-26 15:07:59');
INSERT INTO `transaction_list` VALUES ('494', '4', '1', '2025122605', '27671', '149', 'Lamp Problem', 'Igniter dale hai 350 wt', 'Sharpy Spro 15r', '26/12/25', '5000.00', '0.00', '150.00', '0', '5', '2025-12-26 15:09:10', '2025-12-26 15:09:10', '2025-12-26 15:09:10');
INSERT INTO `transaction_list` VALUES ('495', '4', '1', '2025122606', '27672', '149', 'Lamp Problem', 'Smps repair 
Display cumminication error ', 'Sharpy Spro 15r', '26/12/25', '2000.00', '0.00', '200.00', '0', '5', '2025-12-26 15:10:00', '2025-12-26 15:10:00', '2025-12-26 15:10:00');
INSERT INTO `transaction_list` VALUES ('496', '4', '1', '2025122607', '27673', '149', 'Dead', '', 'Smps 5v 350w hilight', '26/12/25', '0.00', '0.00', '0.00', '0', '0', '2025-12-26 15:14:45', '2025-12-26 15:18:46', '');
INSERT INTO `transaction_list` VALUES ('497', '3', '1', '2025122608', '27674', '150', 'Heater', '', 'Sparkle S pro ', '26/12/2025', '0.00', '0.00', '0.00', '0', '0', '2025-12-26 16:27:05', '2025-12-26 16:27:05', '');
INSERT INTO `transaction_list` VALUES ('498', '3', '1', '2025122609', '27675', '151', 'Dead', 'dono channel short ho gaye the', 'Home theater boofer', '26/12/2025', '500.00', '0.00', '40.00', '0', '5', '2025-12-26 17:49:29', '2026-01-13 17:17:03', '2026-01-13 17:17:03');
INSERT INTO `transaction_list` VALUES ('501', '4', '1', '2025122701', '27676', '152', 'fader', 'None ', 'Dmx J191 Jia', '27/12/25', '400.00', '0.00', '40.00', '0', '5', '2025-12-27 13:40:46', '2026-01-11 15:24:08', '2026-01-11 15:24:08');
INSERT INTO `transaction_list` VALUES ('502', '4', '2', '2025122702', '27677', '153', 'Dead', 'Smps repair board repair', 'Lpc007', '27/12/2025', '450.00', '0.00', '0.00', '0', '5', '2025-12-27 13:44:11', '2026-01-29 17:53:41', '2026-01-29 17:53:00');
INSERT INTO `transaction_list` VALUES ('503', '4', '2', '2025122703', '27678', '153', 'Dead', '10led smps repair', 'Lpc007', '27/12/2025', '500.00', '0.00', '0.00', '0', '5', '2025-12-27 13:44:37', '2026-01-29 17:53:54', '2026-01-29 17:53:00');
INSERT INTO `transaction_list` VALUES ('504', '4', '2', '2025122704', '27679', '153', 'Dead', 'Tawa dala h 36volt  smps repair ', 'Lpc007', '27/12/2025', '800.00', '0.00', '0.00', '0', '5', '2025-12-27 13:45:18', '2026-01-29 17:55:57', '2026-01-29 17:55:00');
INSERT INTO `transaction_list` VALUES ('505', '4', '2', '2025122705', '27680', '153', 'Dead', 'smps repair', 'Lpc007', '27/12/2025', '350.00', '0.00', '0.00', '0', '5', '2025-12-27 13:45:42', '2026-01-29 17:55:46', '2026-01-29 17:55:00');
INSERT INTO `transaction_list` VALUES ('506', '4', '2', '2025122706', '27681', '153', 'Dead', 'Smps repair   2led  card doosri par ka lgya 
Iska card kharab h ', 'Lpc007', '27/12/2025', '400.00', '0.00', '0.00', '0', '5', '2025-12-27 13:46:06', '2026-01-29 17:55:35', '2026-01-29 17:55:00');
INSERT INTO `transaction_list` VALUES ('507', '4', '2', '2025122707', '27682', '153', 'Dead', 'Smps repair', 'Lpc007', '27/12/2025', '350.00', '0.00', '0.00', '0', '5', '2025-12-27 13:46:30', '2026-01-29 17:55:24', '2026-01-29 17:55:00');
INSERT INTO `transaction_list` VALUES ('508', '4', '2', '2025122708', '27683', '153', 'Dead', 'Smps repair', 'Lpc007', '27/12/2025', '350.00', '0.00', '0.00', '0', '5', '2025-12-27 13:46:53', '2026-01-29 17:55:14', '2026-01-29 17:55:00');
INSERT INTO `transaction_list` VALUES ('509', '4', '2', '2025122709', '27684', '153', 'Dead', 'Tested okk', 'Lpc007', '27/12/2025', '0.00', '0.00', '0.00', '0', '5', '2025-12-27 13:47:16', '2026-01-29 17:54:51', '2026-01-29 17:54:00');
INSERT INTO `transaction_list` VALUES ('510', '4', '2', '2025122710', '27685', '153', 'Dead', 'Smps repaire 9 led lagi ', 'Lpc007', '27/12/2025', '500.00', '0.00', '0.00', '0', '5', '2025-12-27 13:47:38', '2026-01-29 17:54:42', '2026-01-29 17:54:00');
INSERT INTO `transaction_list` VALUES ('511', '4', '2', '2025122711', '27686', '153', 'Dead', 'Service', 'Lpc007', '27/12/2025', '350.00', '0.00', '0.00', '0', '5', '2025-12-27 13:48:10', '2026-01-29 17:54:29', '2026-01-29 17:54:00');
INSERT INTO `transaction_list` VALUES ('512', '4', '2', '2025122712', '27687', '153', 'Dead', 'Fan28vlt and service', 'Lpc007', '27/12/2025', '400.00', '0.00', '0.00', '0', '5', '2025-12-27 13:48:32', '2026-01-29 17:54:16', '2026-01-29 17:54:00');
INSERT INTO `transaction_list` VALUES ('513', '4', '2', '2025122713', '27688', '153', 'Dead', 'board repair', 'Lpc007', '27/12/2025', '300.00', '0.00', '0.00', '0', '5', '2025-12-27 13:48:52', '2026-01-29 17:54:06', '2026-01-29 17:54:00');
INSERT INTO `transaction_list` VALUES ('514', '4', '2', '2025122714', '27689', '153', 'Dead', 'led board repair', 'Lpc007', '27/12/2025', '250.00', '0.00', '0.00', '0', '5', '2025-12-27 13:49:39', '2026-01-29 17:57:02', '2026-01-29 17:56:00');
INSERT INTO `transaction_list` VALUES ('515', '4', '2', '2025122715', '27690', '153', 'Dead', 'Smps repair', 'Lpc007', '27/12/2025', '350.00', '0.00', '0.00', '0', '5', '2025-12-27 13:50:02', '2026-01-29 17:56:50', '2026-01-29 17:56:00');
INSERT INTO `transaction_list` VALUES ('516', '4', '2', '2025122716', '27691', '153', 'Dead', 'led board and smps repair ', 'Lpc007', '27/12/2025', '500.00', '0.00', '0.00', '0', '5', '2025-12-27 13:50:23', '2026-01-29 17:56:42', '2026-01-29 17:56:00');
INSERT INTO `transaction_list` VALUES ('517', '4', '2', '2025122717', '27692', '153', 'Dead', 'Service Card  ', 'Lpc007', '27/12/2025', '300.00', '0.00', '0.00', '0', '5', '2025-12-27 13:50:44', '2026-01-29 17:56:33', '2026-01-29 17:56:00');
INSERT INTO `transaction_list` VALUES ('518', '4', '2', '2025122718', '27693', '153', 'Dead', '36vlt fan ... 8 led', 'Lpc007', '27/12/2025', '500.00', '0.00', '0.00', '0', '5', '2025-12-27 13:51:18', '2026-01-29 17:56:24', '2026-01-29 17:56:00');
INSERT INTO `transaction_list` VALUES ('519', '4', '2', '2025122719', '27694', '153', 'Dead', '', 'Lpc007', '27/12/2025', '0.00', '0.00', '0.00', '0', '4', '2025-12-27 13:51:38', '2026-01-06 19:19:59', '');
INSERT INTO `transaction_list` VALUES ('520', '4', '2', '2025122720', '27695', '153', 'Dead', 'Smps repair', 'Lpc007', '27/12/2025', '350.00', '0.00', '0.00', '0', '5', '2025-12-27 13:52:04', '2026-01-29 17:56:13', '2026-01-29 17:56:00');
INSERT INTO `transaction_list` VALUES ('521', '4', '2', '2025122721', '27696', '153', 'Dead', 'Smps repair ', 'Lpc007', '27/12/2025', '350.00', '0.00', '0.00', '0', '5', '2025-12-27 13:52:37', '2026-01-29 17:53:29', '2026-01-29 17:53:00');
INSERT INTO `transaction_list` VALUES ('522', '4', '2', '2025122722', '27697', '153', 'Dead', 'Smps repair', 'Lpc007', '27/12/2025', '350.00', '0.00', '0.00', '0', '5', '2025-12-27 13:53:00', '2026-01-29 17:53:14', '2026-01-29 17:53:00');
INSERT INTO `transaction_list` VALUES ('523', '4', '2', '2025122723', '27698', '153', 'Dead', 'Smps repair', 'Lpc007', '27/12/2025', '350.00', '0.00', '0.00', '0', '5', '2025-12-27 13:53:41', '2026-01-29 17:52:45', '2026-01-29 17:52:00');
INSERT INTO `transaction_list` VALUES ('524', '3', '2', '2025122724', '27699', '154', 'Dead', '', 'Smps 5v 300w hi light modeln. - NT-FA-1825B', '27/12/2025', '500.00', '0.00', '0.00', '0', '5', '2025-12-27 15:02:39', '2025-12-27 15:02:39', '2025-12-27 15:02:39');
INSERT INTO `transaction_list` VALUES ('525', '4', '1', '2025122725', '27700', '155', 'Blinking fault ', 'None ', 'hp pc SMPS hipro', '27/12/25', '500.00', '0.00', '50.00', '0', '5', '2025-12-27 15:39:33', '2025-12-27 15:39:33', '2025-12-27 15:39:33');
INSERT INTO `transaction_list` VALUES ('526', '3', '1', '2025122801', '27701', '156', 'Heating', '', 'Seprater RT 943', '28/12/2025', '350.00', '0.00', '35.00', '0', '5', '2025-12-28 12:20:06', '2025-12-28 12:20:06', '2025-12-28 12:20:06');
INSERT INTO `transaction_list` VALUES ('528', '3', '1', '2025122802', '27702', '157', 'Pan tilt ', 'Black and white color ka hai', '1024 stan ', '28/12/2025', '0.00', '0.00', '0.00', '0', '5', '2025-12-28 14:19:48', '2026-01-24 12:37:58', '2026-01-24 12:37:58');
INSERT INTO `transaction_list` VALUES ('529', '4', '1', '2025122901', '27703', '6', 'cable flickr ', 'None ', 'fog z2000 stan', '29/12/25', '350.00', '0.00', '35.00', '0', '5', '2025-12-29 10:57:56', '2025-12-29 10:57:56', '2025-12-29 10:57:56');
INSERT INTO `transaction_list` VALUES ('530', '4', '1', '2025122902', '27704', '6', 'couple problem ', 'Ek dmx cable male ', 'par light 007h', '29/12/25', '250.00', '0.00', '25.00', '0', '5', '2025-12-29 11:01:16', '2025-12-29 11:01:16', '2025-12-29 11:01:16');
INSERT INTO `transaction_list` VALUES ('531', '4', '1', '2025122903', '27705', '6', 'couple problem ', 'Tar jode h bus', 'par light 007h', '29/12/25', '200.00', '0.00', '20.00', '0', '5', '2025-12-29 11:02:35', '2025-12-29 11:02:35', '2025-12-29 11:02:35');
INSERT INTO `transaction_list` VALUES ('532', '4', '1', '2025122904', '27706', '6', 'dead ', 'Smps repair', 'par light 007h', '29/12/25', '300.00', '0.00', '30.00', '0', '5', '2025-12-29 11:03:52', '2025-12-29 11:03:52', '2025-12-29 11:03:52');
INSERT INTO `transaction_list` VALUES ('533', '4', '1', '2025122905', '27707', '6', 'dead ', 'None ', 'par light 007h', '29/12/25', '300.00', '0.00', '30.00', '0', '5', '2025-12-29 11:05:06', '2025-12-29 11:05:06', '2025-12-29 11:05:06');
INSERT INTO `transaction_list` VALUES ('534', '4', '1', '2025122906', '27708', '159', 'Dead', '26673,74', '5v 60a SMPS', '7/8/25', '0.00', '0.00', '0.00', '0', '0', '2025-12-29 15:22:41', '2025-12-29 18:33:35', '');
INSERT INTO `transaction_list` VALUES ('535', '4', '1', '2025122907', '27709', '158', 'Head not working', 'Some dry issue ', 'Plotter redcell', '29/12/25', '1500.00', '0.00', '150.00', '0', '5', '2025-12-29 15:48:32', '2025-12-29 15:48:32', '2025-12-29 15:48:32');
INSERT INTO `transaction_list` VALUES ('536', '3', '2', '2025122908', '27710', '109', 'Dead', '', 'Blinder smps', '29/12/25', '500.00', '0.00', '0.00', '0', '5', '2025-12-29 15:55:22', '2025-12-29 15:55:22', '2025-12-29 15:55:22');
INSERT INTO `transaction_list` VALUES ('537', '3', '1', '2025122909', '27711', '109', '3 out ni aa rhe h ', 'None', 'Spleter stan 512dmx 8way pro isolated splitter', '29/12/25', '500.00', '0.00', '50.00', '0', '5', '2025-12-29 15:56:35', '2025-12-29 15:56:35', '2025-12-29 15:56:35');
INSERT INTO `transaction_list` VALUES ('538', '3', '2', '2025123001', '27712', '138', 'Display ', 'Naya card lagaya h ', '2 eyes blinder ', '30/12/2025', '800.00', '0.00', '0.00', '0', '5', '2025-12-30 12:56:02', '2025-12-30 12:56:02', '2025-12-30 12:56:02');
INSERT INTO `transaction_list` VALUES ('539', '3', '2', '2025123002', '27713', '5', 'Igniter ', '', '12r stan sharpy ', '30/12/2025', '3000.00', '0.00', '0.00', '0', '5', '2025-12-30 13:44:48', '2025-12-30 13:44:48', '2025-12-30 13:44:48');
INSERT INTO `transaction_list` VALUES ('540', '4', '1', '2025123003', '27714', '85', 'Dead', 'None', '5v 60a SMPS', '30/12/25', '500.00', '0.00', '50.00', '0', '5', '2025-12-30 18:03:19', '2025-12-30 18:03:19', '2025-12-30 18:03:19');
INSERT INTO `transaction_list` VALUES ('541', '4', '1', '2025123004', '27715', '85', 'Dead', 'None', '5v 60a SMPS', '30/12/24', '500.00', '0.00', '50.00', '0', '5', '2025-12-30 18:04:30', '2025-12-30 18:04:30', '2025-12-30 18:04:30');
INSERT INTO `transaction_list` VALUES ('542', '4', '1', '2025123005', '27716', '85', 'Dead', 'Nitin Pal 8358985469', '5v 60a SMPS', '30/12/25', '0.00', '0.00', '0.00', '0', '0', '2025-12-30 18:05:32', '2025-12-30 18:05:32', '');
INSERT INTO `transaction_list` VALUES ('543', '4', '1', '2025123006', '27717', '161', 'Dead', 'None', 'Power Board tv', '30/12/25', '0.00', '0.00', '0.00', '0', '5', '2025-12-30 19:03:59', '2025-12-30 19:03:59', '2025-12-30 19:03:59');
INSERT INTO `transaction_list` VALUES ('544', '4', '1', '2025123101', '27718', '162', 'No lamp', 'New lamp 230w', 'Sharpy Beam 200', '31/12/25', '2800.00', '0.00', '50.00', '0', '5', '2025-12-31 17:53:25', '2025-12-31 17:53:25', '2025-12-31 17:53:25');
INSERT INTO `transaction_list` VALUES ('545', '3', '2', '2026010201', '27719', '163', 'Heating ', '', 'Quickkt 786 blue colour ', '', '0.00', '0.00', '0.00', '0', '0', '2026-01-02 12:55:58', '2026-01-02 15:28:48', '2026-01-02 12:55:58');
INSERT INTO `transaction_list` VALUES ('546', '3', '1', '2026010202', '27720', '66', 'Dead', '7000437691 abhishek bhai', 'Sparkle  s- pro', '', '1500.00', '0.00', '150.00', '0', '5', '2026-01-02 16:36:19', '2026-01-24 14:49:52', '2026-01-24 14:49:21');
INSERT INTO `transaction_list` VALUES ('547', '3', '2', '2026010301', '27721', '164', 'Heat outo oprate', '', 'Seprater quick999', '', '500.00', '0.00', '0.00', '0', '5', '2026-01-03 14:13:58', '2026-01-05 14:20:20', '2026-01-05 14:20:09');
INSERT INTO `transaction_list` VALUES ('548', '4', '1', '2026010302', '27722', '165', 'Dead', 'Returned', 'Charger Pcb', '', '0.00', '0.00', '0.00', '0', '5', '2026-01-03 19:43:29', '2026-01-11 15:20:45', '2026-01-11 15:20:29');
INSERT INTO `transaction_list` VALUES ('549', '4', '1', '2026010501', '27723', '166', 'dc volt problem', '', 'pcb silai machine', '', '0.00', '0.00', '0.00', '0', '5', '2026-01-05 13:29:46', '2026-01-05 18:46:29', '2026-01-05 18:46:29');
INSERT INTO `transaction_list` VALUES ('550', '4', '2', '2026010502', '27724', '167', 'dead', 'Ring tuta hai, side cover nahi hai', 'Sharpy Stan Tabahi', '', '1500.00', '0.00', '0.00', '0', '5', '2026-01-05 14:45:59', '2026-01-07 15:25:42', '2026-01-07 15:25:42');
INSERT INTO `transaction_list` VALUES ('551', '4', '2', '2026010503', '27725', '167', 'Dead', 'Lock neeche ka ', 'Sharpy Stan Tabahi ', '', '1500.00', '0.00', '0.00', '0', '5', '2026-01-05 14:47:17', '2026-01-07 15:25:26', '2026-01-07 15:25:26');
INSERT INTO `transaction_list` VALUES ('552', '3', '1', '2026010504', '27726', '140', 'Awaz nhi aa rahi hai', '', 'Zebronics home thaeater ', '', '0.00', '0.00', '0.00', '0', '0', '2026-01-05 15:50:33', '2026-01-05 15:50:33', '');
INSERT INTO `transaction_list` VALUES ('553', '4', '1', '2026010505', '27727', '168', 'Dead', 'Display board laga h ', 'sparkle machine SSE', '', '3100.00', '0.00', '50.00', '0', '5', '2026-01-05 16:29:43', '2026-01-21 18:43:12', '2026-01-21 18:43:12');
INSERT INTO `transaction_list` VALUES ('554', '4', '1', '2026010506', '27728', '168', 'Dead', 'Naya display laga diya h ', 'Sparkle Machine SSE', '', '3100.00', '0.00', '50.00', '0', '5', '2026-01-05 16:30:42', '2026-01-21 18:43:04', '2026-01-21 18:43:04');
INSERT INTO `transaction_list` VALUES ('555', '4', '1', '2026010507', '27729', '168', 'Dead', 'New board', 'Sparkle Machine SSE', '', '3100.00', '0.00', '50.00', '0', '5', '2026-01-05 16:31:28', '2026-01-21 18:42:56', '2026-01-21 18:42:56');
INSERT INTO `transaction_list` VALUES ('556', '4', '1', '2026010508', '27730', '168', 'Dead', 'pcb repair', 'Sparkle Machine SSE', '', '1500.00', '0.00', '150.00', '0', '5', '2026-01-05 16:32:20', '2026-01-21 18:42:48', '2026-01-21 18:42:48');
INSERT INTO `transaction_list` VALUES ('557', '4', '1', '2026010509', '27731', '80', 'Usb Short circuit', '', 'Plotter TI', '', '0.00', '0.00', '0.00', '0', '5', '2026-01-05 19:05:30', '2026-01-06 12:36:03', '2026-01-06 12:36:03');
INSERT INTO `transaction_list` VALUES ('558', '3', '1', '2026010601', '27732', '169', 'Dead', '', 'Seprater kt 999', '', '350.00', '0.00', '35.00', '0', '5', '2026-01-06 13:40:48', '2026-01-18 19:04:13', '2026-01-18 19:04:13');
INSERT INTO `transaction_list` VALUES ('559', '3', '1', '2026010602', '27733', '168', 'Automatic chal rahi h ', 'pcb repair', 'Sparkle sse', '', '800.00', '0.00', '80.00', '0', '5', '2026-01-06 14:30:53', '2026-01-21 18:42:36', '2026-01-21 18:42:36');
INSERT INTO `transaction_list` VALUES ('560', '3', '2', '2026010701', '27734', '170', 'Ek side kam nhi kr rha h ', '', 'Bubble machine wow', '', '800.00', '0.00', '0.00', '0', '5', '2026-01-07 13:44:28', '2026-01-07 22:08:46', '2026-01-07 22:08:46');
INSERT INTO `transaction_list` VALUES ('561', '4', '2', '2026010702', '27735', '107', 'low pressure', 'pump dala h 48wt', 'Fog Stan Z-2000', '', '1700.00', '0.00', '0.00', '0', '5', '2026-01-07 16:22:15', '2026-01-14 15:04:15', '2026-01-14 15:04:15');
INSERT INTO `transaction_list` VALUES ('562', '4', '1', '2026010703', '27736', '171', 'broken', '', 'Sharpy Stan 650', '', '1500.00', '0.00', '150.00', '0', '5', '2026-01-07 16:33:00', '2026-01-07 22:04:37', '2026-01-07 22:04:37');
INSERT INTO `transaction_list` VALUES ('563', '4', '1', '2026010704', '27737', '171', 'abnormal working', '', 'Sharpy Stan 650', '', '0.00', '0.00', '0.00', '0', '5', '2026-01-07 16:35:28', '2026-01-07 22:04:16', '2026-01-07 22:04:16');
INSERT INTO `transaction_list` VALUES ('564', '4', '2', '2026010705', '27738', '171', 'Unknown', 'Display ni aa rha tha  focas sahi kiye h ', 'sharpy BSM Beast', '', '1500.00', '0.00', '0.00', '0', '5', '2026-01-07 16:38:44', '2026-01-07 22:04:04', '2026-01-07 22:04:04');
INSERT INTO `transaction_list` VALUES ('565', '4', '1', '2026010706', '27739', '171', 'Unknown', 'new igniter, new ph lamp', 'sharpy BSM Beast', '', '6000.00', '0.00', '50.00', '0', '5', '2026-01-07 16:39:34', '2026-01-20 15:30:00', '2026-01-07 22:03:52');
INSERT INTO `transaction_list` VALUES ('566', '4', '1', '2026010707', '27740', '171', 'Unknown', '', 'sharpy BSM Beast', '', '1500.00', '0.00', '150.00', '0', '5', '2026-01-07 16:40:27', '2026-01-07 22:03:38', '2026-01-07 22:03:38');
INSERT INTO `transaction_list` VALUES ('567', '4', '1', '2026010708', '27741', '171', 'Unknown', 'Neeche ka lock sahi kiya h ', 'sharpy BSM Beast', '', '1500.00', '0.00', '150.00', '0', '5', '2026-01-07 16:41:07', '2026-01-22 18:42:52', '2026-01-22 18:42:52');
INSERT INTO `transaction_list` VALUES ('568', '4', '2', '2026010709', '27742', '171', 'Unknown', 'Tested okk ', 'sharpy BSM Beast', '', '0.00', '0.00', '0.00', '0', '5', '2026-01-07 16:41:51', '2026-01-07 22:03:23', '2026-01-07 22:03:23');
INSERT INTO `transaction_list` VALUES ('569', '4', '2', '2026010710', '27743', '171', 'Unknown', 'Tested okk', 'sharpy BSM Beast', '', '0.00', '0.00', '0.00', '0', '5', '2026-01-07 16:42:16', '2026-01-07 22:03:07', '2026-01-07 22:03:07');
INSERT INTO `transaction_list` VALUES ('570', '4', '1', '2026010711', '27744', '171', 'body bend', 'Prism and rotating ', 'sharpy BSM Beast', '', '1500.00', '0.00', '150.00', '0', '5', '2026-01-07 16:42:41', '2026-01-22 18:42:28', '2026-01-22 18:42:28');
INSERT INTO `transaction_list` VALUES ('571', '4', '1', '2026010712', '27745', '171', 'Unknown', 'Tested okk', 'sharpy BSM Beast', '', '0.00', '0.00', '0.00', '0', '5', '2026-01-07 16:44:52', '2026-01-07 22:02:47', '2026-01-07 22:02:47');
INSERT INTO `transaction_list` VALUES ('572', '4', '1', '2026010713', '27746', '171', 'Unknown', 'Side card wire', 'sharpy BSM Beast', '', '1500.00', '0.00', '150.00', '0', '5', '2026-01-07 16:45:27', '2026-01-07 22:02:31', '2026-01-07 22:02:31');
INSERT INTO `transaction_list` VALUES ('573', '4', '2', '2026010714', '27747', '171', 'Unknown', '', 'sharpy BSM Beast', '', '500.00', '0.00', '0.00', '0', '5', '2026-01-07 16:45:50', '2026-01-07 22:02:11', '2026-01-07 22:02:11');
INSERT INTO `transaction_list` VALUES ('574', '4', '1', '2026010715', '27748', '171', 'Dead', '', 'Blinders 2 e BSM', '', '500.00', '0.00', '50.00', '0', '5', '2026-01-07 16:48:04', '2026-01-07 22:01:33', '2026-01-07 22:01:33');
INSERT INTO `transaction_list` VALUES ('575', '4', '2', '2026010716', '27749', '171', 'glass dalna hai', '', 'Atomic Strobe ', '', '0.00', '0.00', '0.00', '0', '5', '2026-01-07 16:50:09', '2026-01-07 22:01:07', '2026-01-07 22:01:07');
INSERT INTO `transaction_list` VALUES ('576', '4', '2', '2026010717', '27750', '171', 'dead', '', 'atomic cospo', '', '0.00', '0.00', '0.00', '0', '5', '2026-01-07 16:52:48', '2026-01-31 15:52:25', '2026-01-31 15:52:00');
INSERT INTO `transaction_list` VALUES ('577', '4', '1', '2026010718', '27751', '171', 'dead ', '', 'atomic cospo ', '', '0.00', '0.00', '0.00', '0', '5', '2026-01-07 16:53:38', '2026-01-31 15:53:31', '2026-01-31 15:53:00');
INSERT INTO `transaction_list` VALUES ('578', '4', '1', '2026010719', '27752', '171', 'dead ', '', 'atomic cospo ', '', '0.00', '0.00', '0.00', '0', '5', '2026-01-07 16:54:15', '2026-01-31 15:53:21', '2026-01-31 15:53:00');
INSERT INTO `transaction_list` VALUES ('579', '4', '1', '2026010720', '27753', '171', 'dead ', '', 'atomic cospo ', '', '0.00', '0.00', '0.00', '0', '5', '2026-01-07 16:55:07', '2026-01-31 15:53:10', '2026-01-31 15:53:00');
INSERT INTO `transaction_list` VALUES ('580', '4', '1', '2026010721', '27754', '171', 'dead ', '', 'atomic cospo ', '', '0.00', '0.00', '0.00', '0', '5', '2026-01-07 16:55:45', '2026-01-31 15:52:58', '2026-01-31 15:52:00');
INSERT INTO `transaction_list` VALUES ('581', '4', '1', '2026010722', '27755', '171', 'dum ', '', 'mi bar money light ', '', '0.00', '0.00', '0.00', '0', '5', '2026-01-07 16:56:33', '2026-01-07 22:00:46', '2026-01-07 22:00:46');
INSERT INTO `transaction_list` VALUES ('582', '4', '2', '2026010723', '27756', '171', 'no fog', 'Heater lga h ', 'fog up BSM jet', '', '3000.00', '0.00', '0.00', '0', '5', '2026-01-07 16:57:56', '2026-01-22 18:33:16', '2026-01-22 18:33:16');
INSERT INTO `transaction_list` VALUES ('583', '3', '1', '2026010801', '27757', '91', 'Pata nhi', 'Heat Sensor and service', 'Smoke F-3000up', '', '500.00', '0.00', '50.00', '0', '5', '2026-01-08 12:50:10', '2026-01-24 15:16:25', '2026-01-24 15:16:25');
INSERT INTO `transaction_list` VALUES ('584', '3', '2', '2026010802', '27758', '172', 'Dead', '', ' Smd Kada 2018d+ ', '', '0.00', '0.00', '0.00', '0', '0', '2026-01-08 17:30:51', '2026-01-08 17:30:51', '');
INSERT INTO `transaction_list` VALUES ('585', '3', '2', '2026010901', '27759', '174', 'Garam nhi ho rha h ', '', 'Seprater', '', '400.00', '0.00', '0.00', '0', '5', '2026-01-09 15:58:20', '2026-01-11 15:10:57', '2026-01-11 15:10:57');
INSERT INTO `transaction_list` VALUES ('586', '3', '2', '2026010902', '27760', '174', 'Dead ', '', 'Seprator skt', '', '0.00', '0.00', '0.00', '0', '0', '2026-01-09 15:58:46', '2026-01-09 15:58:46', '');
INSERT INTO `transaction_list` VALUES ('587', '4', '1', '2026011001', '27761', '175', 'look', '', 'Sharpy 17r', '', '0.00', '0.00', '0.00', '0', '0', '2026-01-10 15:01:01', '2026-01-10 15:01:01', '');
INSERT INTO `transaction_list` VALUES ('588', '4', '1', '2026011002', '27762', '175', 'Dead', '', 'Sharpy card', '', '0.00', '0.00', '0.00', '0', '0', '2026-01-10 15:02:22', '2026-01-10 15:02:22', '');
INSERT INTO `transaction_list` VALUES ('589', '4', '1', '2026011003', '27763', '175', 'Dead', '', 'Sharpy card', '', '0.00', '0.00', '0.00', '0', '0', '2026-01-10 15:05:00', '2026-01-10 15:05:00', '');
INSERT INTO `transaction_list` VALUES ('590', '3', '2', '2026011004', '27764', '177', 'Dead', '', 'Smoke 1500wt', '', '1200.00', '0.00', '0.00', '0', '5', '2026-01-10 17:07:14', '2026-01-11 15:12:48', '2026-01-11 15:12:48');
INSERT INTO `transaction_list` VALUES ('591', '3', '2', '2026011005', '27765', '178', 'Dead', '', 'Shot killer  sunshine ', '', '0.00', '0.00', '0.00', '0', '0', '2026-01-10 18:30:10', '2026-01-11 18:45:54', '');
INSERT INTO `transaction_list` VALUES ('592', '3', '2', '2026011006', '27766', '178', 'Dead', '', 'Ultra sonic cleaner ', '', '300.00', '0.00', '0.00', '0', '5', '2026-01-10 18:31:11', '2026-01-12 19:47:46', '2026-01-12 19:47:46');
INSERT INTO `transaction_list` VALUES ('593', '4', '2', '2026011101', '27767', '180', 'Colour Disturb', '', 'Laser 10 rgb zenith', '', '500.00', '0.00', '0.00', '0', '5', '2026-01-11 15:44:05', '2026-01-11 18:50:41', '2026-01-11 18:45:08');
INSERT INTO `transaction_list` VALUES ('594', '4', '2', '2026011201', '27768', '107', 'motor', '2 motor dali h X Y
26704', 'sharpy 12r', '', '8500.00', '0.00', '0.00', '0', '5', '2026-01-12 13:11:45', '2026-01-12 13:12:58', '2026-01-12 13:12:58');
INSERT INTO `transaction_list` VALUES ('595', '4', '1', '2026011202', '27769', '181', 'low sparkle ', 'mb repair', 'sparkle machine spro s1', '', '1000.00', '0.00', '100.00', '0', '5', '2026-01-12 14:47:26', '2026-01-13 12:28:20', '2026-01-13 12:28:20');
INSERT INTO `transaction_list` VALUES ('596', '4', '1', '2026011203', '27770', '181', 'dead', 'plunger repaired', 'Fire ', '', '0.00', '0.00', '0.00', '0', '5', '2026-01-12 14:48:44', '2026-01-13 12:27:36', '2026-01-13 12:27:36');
INSERT INTO `transaction_list` VALUES ('597', '3', '2', '2026011204', '27771', '182', 'Batry ', '', 'Saregama carvaan', '', '250.00', '0.00', '0.00', '0', '5', '2026-01-12 15:26:00', '2026-01-12 19:44:30', '2026-01-12 19:44:30');
INSERT INTO `transaction_list` VALUES ('598', '4', '1', '2026011205', '27772', '178', 'Dead', '', 'T210 Soldering Iron', '', '0.00', '0.00', '0.00', '0', '0', '2026-01-12 19:45:47', '2026-01-12 19:45:47', '');
INSERT INTO `transaction_list` VALUES ('599', '3', '1', '2026011301', '27773', '183', 'Dmx me issue h ', 'Display repair and new encoder', 'Sharpy 12R Stan', '', '1500.00', '0.00', '150.00', '0', '5', '2026-01-13 15:30:51', '2026-01-14 14:30:30', '2026-01-13 20:10:08');
INSERT INTO `transaction_list` VALUES ('600', '3', '2', '2026011401', '27774', '19', 'Dead', 'Lamp high glow', 'Sharpy saif ', '', '2500.00', '0.00', '0.00', '0', '5', '2026-01-14 12:24:30', '2026-01-17 18:54:14', '2026-01-17 18:54:14');
INSERT INTO `transaction_list` VALUES ('601', '3', '2', '2026011402', '27775', '19', 'Dead', 'Smps repair', 'Sharpy saif ', '', '800.00', '0.00', '0.00', '0', '5', '2026-01-14 12:24:52', '2026-01-17 18:53:58', '2026-01-17 18:53:58');
INSERT INTO `transaction_list` VALUES ('602', '3', '2', '2026011403', '27776', '19', 'Dead', 'Smps repair', 'Sharpy saif ', '', '800.00', '0.00', '0.00', '0', '5', '2026-01-14 12:25:13', '2026-01-17 18:53:42', '2026-01-17 18:53:42');
INSERT INTO `transaction_list` VALUES ('603', '3', '2', '2026011404', '27777', '19', 'Dead', 'Smps repair, new igniter dala h ', 'Sharpy saif ', '', '3000.00', '0.00', '0.00', '0', '5', '2026-01-14 12:25:38', '2026-01-17 18:53:24', '2026-01-17 18:53:24');
INSERT INTO `transaction_list` VALUES ('604', '3', '2', '2026011405', '27778', '19', 'Dead', 'Smps repair ', 'Sharpy saif ', '', '800.00', '0.00', '0.00', '0', '5', '2026-01-14 12:26:00', '2026-01-17 18:53:07', '2026-01-17 18:53:07');
INSERT INTO `transaction_list` VALUES ('605', '3', '2', '2026011406', '27779', '19', 'Dead', 'Fan Error from side card to display abnormally, Display Repaired', 'Sharpy saif', '', '1500.00', '0.00', '0.00', '0', '5', '2026-01-14 12:26:26', '2026-01-17 18:52:33', '2026-01-17 18:52:33');
INSERT INTO `transaction_list` VALUES ('606', '3', '2', '2026011407', '27780', '19', 'Dead', 'Smps repair igniter new lamp high glow new', 'Sharpy saif ', '', '5500.00', '0.00', '0.00', '0', '5', '2026-01-14 12:26:58', '2026-01-17 18:52:11', '2026-01-17 18:52:11');
INSERT INTO `transaction_list` VALUES ('607', '3', '1', '2026011408', '27781', '184', 'Dead', 'new dc machine', 'Adapter cvc machine  great wall', '', '4700.00', '0.00', '20.00', '0', '5', '2026-01-14 12:56:31', '2026-01-19 13:15:53', '2026-01-14 20:06:16');
INSERT INTO `transaction_list` VALUES ('608', '4', '2', '2026011409', '27782', '185', 'Dead', 'Fan28volt 36volt led plate', 'par light', '', '900.00', '0.00', '0.00', '0', '5', '2026-01-14 18:16:05', '2026-01-30 19:31:27', '2026-01-30 19:31:00');
INSERT INTO `transaction_list` VALUES ('609', '3', '2', '2026011410', '27783', '185', 'Dead', 'Fan28vlt 36volt led plate', 'Par Light', '', '900.00', '0.00', '0.00', '0', '5', '2026-01-14 20:08:23', '2026-01-30 19:23:19', '2026-01-30 19:23:00');
INSERT INTO `transaction_list` VALUES ('610', '4', '2', '2026011411', '27784', '185', 'Dead', '', 'Par Light', '', '0.00', '0.00', '0.00', '0', '1', '2026-01-14 21:10:30', '2026-01-30 15:02:11', '');
INSERT INTO `transaction_list` VALUES ('611', '4', '2', '2026011412', '27785', '185', 'Dead', '', 'Par Light', '', '0.00', '0.00', '0.00', '0', '1', '2026-01-14 21:11:21', '2026-01-30 15:05:12', '');
INSERT INTO `transaction_list` VALUES ('612', '4', '2', '2026011413', '27786', '185', 'Dead', '', 'Par Light', '', '0.00', '0.00', '0.00', '0', '1', '2026-01-14 21:11:47', '2026-01-30 15:06:48', '');
INSERT INTO `transaction_list` VALUES ('613', '4', '2', '2026011414', '27787', '185', 'Dead', '2 led', 'Par Light', '', '300.00', '0.00', '0.00', '0', '5', '2026-01-14 21:12:26', '2026-01-30 19:28:33', '2026-01-30 19:28:00');
INSERT INTO `transaction_list` VALUES ('614', '4', '2', '2026011415', '27788', '185', 'Dead', 'Fan28 volt 36volt led plate', 'Par Light', '', '900.00', '0.00', '0.00', '0', '5', '2026-01-14 21:13:10', '2026-01-30 19:38:20', '2026-01-30 19:38:00');
INSERT INTO `transaction_list` VALUES ('615', '4', '2', '2026011416', '27789', '185', 'Dead', '28volt fan 36 volt led plate', 'Par Light', '', '900.00', '0.00', '0.00', '0', '5', '2026-01-14 21:13:45', '2026-01-30 19:24:18', '2026-01-30 19:24:00');
INSERT INTO `transaction_list` VALUES ('616', '4', '2', '2026011417', '27790', '185', 'Dead', 'Service', 'Par Light', '', '300.00', '0.00', '0.00', '0', '2', '2026-01-14 21:14:19', '2026-01-31 13:09:29', '');
INSERT INTO `transaction_list` VALUES ('617', '4', '2', '2026011418', '27791', '185', 'Dead', '', 'Par Light', '', '0.00', '0.00', '0.00', '0', '1', '2026-01-14 21:14:54', '2026-01-30 15:08:17', '');
INSERT INTO `transaction_list` VALUES ('618', '4', '2', '2026011419', '27792', '185', 'Dead', '', 'Par Light', '', '0.00', '0.00', '0.00', '0', '1', '2026-01-14 21:15:21', '2026-01-30 15:08:00', '');
INSERT INTO `transaction_list` VALUES ('619', '4', '2', '2026011420', '27793', '185', 'Dead', '', 'Par Light', '', '0.00', '0.00', '0.00', '0', '1', '2026-01-14 21:16:32', '2026-01-30 15:05:36', '');
INSERT INTO `transaction_list` VALUES ('620', '4', '2', '2026011421', '27794', '185', 'Dead', '', 'Par Light', '', '0.00', '0.00', '0.00', '0', '1', '2026-01-14 21:17:12', '2026-01-30 15:05:58', '');
INSERT INTO `transaction_list` VALUES ('621', '4', '2', '2026011422', '27795', '185', 'Dead', 'Service', 'Par Light', '', '300.00', '0.00', '0.00', '0', '5', '2026-01-14 21:18:26', '2026-01-30 19:33:44', '2026-01-30 19:33:00');
INSERT INTO `transaction_list` VALUES ('622', '4', '2', '2026011423', '27796', '185', 'Dead', '', 'Par Light', '', '0.00', '0.00', '0.00', '0', '1', '2026-01-14 21:19:08', '2026-01-30 15:08:34', '');
INSERT INTO `transaction_list` VALUES ('623', '4', '2', '2026011424', '27797', '185', 'Dead', '28 volt fan 36 volt led plate', 'Par Light', '', '900.00', '0.00', '0.00', '0', '5', '2026-01-14 21:19:30', '2026-01-30 19:31:10', '2026-01-30 19:31:00');
INSERT INTO `transaction_list` VALUES ('624', '4', '2', '2026011425', '27798', '185', 'Dead', '', 'Par Light', '', '0.00', '0.00', '0.00', '0', '1', '2026-01-14 21:19:51', '2026-01-30 15:07:41', '');
INSERT INTO `transaction_list` VALUES ('625', '4', '2', '2026011426', '27799', '185', 'Dead', '', 'Par Light', '', '0.00', '0.00', '0.00', '0', '1', '2026-01-14 21:20:10', '2026-01-30 15:09:45', '');
INSERT INTO `transaction_list` VALUES ('626', '4', '2', '2026011427', '27800', '185', 'Dead', '', 'Par Light', '', '0.00', '0.00', '0.00', '0', '1', '2026-01-14 21:21:46', '2026-01-30 15:09:26', '');
INSERT INTO `transaction_list` VALUES ('627', '4', '2', '2026011428', '27801', '185', 'Dead', 'Led plate repair ', 'Par Light', '', '350.00', '0.00', '0.00', '0', '5', '2026-01-14 21:22:22', '2026-01-30 19:23:00', '2026-01-30 19:22:00');
INSERT INTO `transaction_list` VALUES ('628', '4', '2', '2026011429', '27802', '185', 'Dead', '', 'Par Light', '', '0.00', '0.00', '0.00', '0', '1', '2026-01-14 21:22:54', '2026-01-30 15:06:18', '');
INSERT INTO `transaction_list` VALUES ('629', '4', '2', '2026011430', '27803', '185', 'Dead', 'Service', 'Par Light', '', '300.00', '0.00', '0.00', '0', '5', '2026-01-14 21:23:41', '2026-01-30 19:27:34', '2026-01-30 19:27:00');
INSERT INTO `transaction_list` VALUES ('630', '4', '2', '2026011431', '27804', '185', 'Dead', '', 'Par Light', '', '0.00', '0.00', '0.00', '0', '1', '2026-01-14 21:24:14', '2026-01-30 15:07:08', '');
INSERT INTO `transaction_list` VALUES ('631', '4', '2', '2026011432', '27805', '185', 'Dead', ',28volt fan 36 volt led plate', 'Par Light', '', '900.00', '0.00', '0.00', '0', '5', '2026-01-14 21:24:45', '2026-01-30 19:30:57', '2026-01-30 19:30:00');
INSERT INTO `transaction_list` VALUES ('632', '4', '2', '2026011433', '27806', '185', 'Dead', '28volt fan 36volt led plate', 'Par Light', '', '900.00', '0.00', '0.00', '0', '5', '2026-01-14 21:25:11', '2026-01-30 19:34:05', '2026-01-30 19:34:00');
INSERT INTO `transaction_list` VALUES ('633', '4', '2', '2026011434', '27807', '185', 'Dead', '', 'Par Light', '', '0.00', '0.00', '0.00', '0', '1', '2026-01-14 21:25:28', '2026-01-30 15:10:03', '');
INSERT INTO `transaction_list` VALUES ('634', '4', '2', '2026011435', '27808', '185', 'Dead', 'Card repair ', 'Par Light', '', '200.00', '0.00', '0.00', '0', '5', '2026-01-14 21:25:59', '2026-01-30 19:29:28', '2026-01-30 19:29:00');
INSERT INTO `transaction_list` VALUES ('635', '4', '2', '2026011436', '27809', '185', 'Dead', '', 'Par Light', '', '0.00', '0.00', '0.00', '0', '1', '2026-01-14 21:26:32', '2026-01-30 15:07:25', '');
INSERT INTO `transaction_list` VALUES ('636', '4', '2', '2026011437', '27810', '185', 'Dead', 'Led plate repair', 'Par Light', '', '400.00', '0.00', '0.00', '0', '5', '2026-01-14 21:26:59', '2026-01-30 19:35:48', '2026-01-30 19:35:00');
INSERT INTO `transaction_list` VALUES ('637', '4', '2', '2026011438', '27811', '185', 'Dead', 'Fan led plate new ', 'Par Light', '', '900.00', '0.00', '0.00', '0', '5', '2026-01-14 21:27:22', '2026-01-30 19:25:42', '2026-01-30 19:25:00');
INSERT INTO `transaction_list` VALUES ('638', '4', '2', '2026011439', '27812', '185', 'Dead', 'Fan 28vlt led plate 36volt ', 'Par Light', '', '900.00', '0.00', '0.00', '0', '5', '2026-01-14 21:27:40', '2026-01-30 19:21:15', '2026-01-30 19:21:00');
INSERT INTO `transaction_list` VALUES ('639', '4', '2', '2026011440', '27813', '185', 'Dead', 'Fan28vlt led plat 36volt', 'Par Light', '', '900.00', '0.00', '0.00', '0', '5', '2026-01-14 21:28:15', '2026-01-30 19:19:33', '2026-01-30 19:19:00');
INSERT INTO `transaction_list` VALUES ('640', '4', '2', '2026011441', '27814', '185', 'Dead', 'Service', 'Par Light', '', '300.00', '0.00', '0.00', '0', '5', '2026-01-14 21:28:36', '2026-01-30 19:38:53', '2026-01-30 19:38:00');
INSERT INTO `transaction_list` VALUES ('641', '4', '2', '2026011442', '27815', '185', 'Dead', 'Fan28volt led plate 36volt', 'Par Light', '', '900.00', '0.00', '0.00', '0', '5', '2026-01-14 21:28:55', '2026-01-30 19:23:58', '2026-01-30 19:23:00');
INSERT INTO `transaction_list` VALUES ('642', '4', '2', '2026011443', '27816', '185', 'Dead', 'Fan28volt 36volt led plate', 'Par Light', '', '900.00', '0.00', '0.00', '0', '5', '2026-01-14 21:29:14', '2026-01-30 19:38:33', '2026-01-30 19:38:00');
INSERT INTO `transaction_list` VALUES ('643', '4', '2', '2026011444', '27817', '185', 'Dead', 'Fan tawa', 'Par Light', '', '900.00', '0.00', '0.00', '0', '5', '2026-01-14 21:29:46', '2026-01-30 19:25:56', '2026-01-30 19:25:00');
INSERT INTO `transaction_list` VALUES ('644', '4', '2', '2026011445', '27818', '185', 'Dead', '', 'Par Light', '', '300.00', '0.00', '0.00', '0', '5', '2026-01-14 21:30:07', '2026-01-30 19:35:00', '2026-01-30 19:34:00');
INSERT INTO `transaction_list` VALUES ('645', '4', '1', '2026011446', '27819', '187', 'Dead', 'Wire Broken and diplay supply pcb burnt', 'Baisun beam 280', '', '1500.00', '0.00', '150.00', '0', '5', '2026-01-14 21:31:47', '2026-01-14 21:31:52', '2026-01-14 21:31:52');
INSERT INTO `transaction_list` VALUES ('653', '4', '1', '2026011601', '27820', '188', 'sensor problem', '', 'industrial drier control board', '', '2000.00', '0.00', '200.00', '0', '5', '2026-01-16 17:39:23', '2026-01-17 17:24:57', '2026-01-17 17:24:57');
INSERT INTO `transaction_list` VALUES ('654', '3', '2', '2026011701', '27821', '19', 'Dead ', '', '4 eyes ', '', '0.00', '0.00', '0.00', '0', '0', '2026-01-17 13:57:58', '2026-01-17 13:57:58', '');
INSERT INTO `transaction_list` VALUES ('655', '3', '2', '2026011702', '27822', '19', 'Led ', 'Ek led ', '4 eyes ', '', '0.00', '0.00', '0.00', '0', '2', '2026-01-17 13:57:58', '2026-01-18 15:33:23', '');
INSERT INTO `transaction_list` VALUES ('656', '3', '2', '2026011703', '27823', '19', 'Dead ', '', '4 eyes ', '', '0.00', '0.00', '0.00', '0', '0', '2026-01-17 13:57:58', '2026-01-17 13:57:58', '');
INSERT INTO `transaction_list` VALUES ('657', '3', '2', '2026011704', '27824', '19', 'Led ', '', '4 eyes ', '', '0.00', '0.00', '0.00', '0', '0', '2026-01-17 13:57:58', '2026-01-17 13:57:58', '');
INSERT INTO `transaction_list` VALUES ('658', '3', '2', '2026011705', '27825', '19', 'Lence', 'Service ', '4 eyes', '', '0.00', '0.00', '0.00', '0', '2', '2026-01-17 13:57:58', '2026-01-18 13:57:03', '');
INSERT INTO `transaction_list` VALUES ('659', '3', '2', '2026011706', '27826', '19', 'Ek chanel band h ', 'jala hua tha andar se', 'Power pack 6 chanel (brand- prabhat)', '', '600.00', '0.00', '0.00', '0', '5', '2026-01-17 13:57:58', '2026-01-26 14:26:07', '2026-01-26 14:26:00');
INSERT INTO `transaction_list` VALUES ('660', '4', '2', '2026011707', '27827', '141', 'dead', '', 'induction', '', '0.00', '0.00', '0.00', '0', '5', '2026-01-17 14:42:23', '2026-01-21 18:41:24', '2026-01-21 18:41:24');
INSERT INTO `transaction_list` VALUES ('661', '4', '2', '2026011708', '27828', '141', 'dead', '', 'induction', '', '0.00', '0.00', '0.00', '0', '5', '2026-01-17 14:42:23', '2026-01-21 18:41:42', '2026-01-21 18:41:42');
INSERT INTO `transaction_list` VALUES ('662', '4', '2', '2026011709', '27829', '141', 'dead', '', 'induction ', '', '0.00', '0.00', '0.00', '0', '5', '2026-01-17 14:42:23', '2026-01-21 18:41:50', '2026-01-21 18:41:50');
INSERT INTO `transaction_list` VALUES ('663', '3', '2', '2026011710', '27830', '189', 'Dmx nhi le rhi h ', 'Tested okk ', 'Sparkel wow ', 'Deliverd', '0.00', '0.00', '0.00', '0', '5', '2026-01-17 16:58:07', '2026-01-18 16:58:12', '2026-01-17 17:05:39');
INSERT INTO `transaction_list` VALUES ('664', '4', '1', '2026011801', '27831', '190', 'Buttons 3, 10 and 9', '', 'pearl 1024', '', '500.00', '0.00', '50.00', '0', '5', '2026-01-18 17:42:18', '2026-01-19 11:21:57', '2026-01-19 11:21:57');
INSERT INTO `transaction_list` VALUES ('665', '4', '1', '2026011901', '27832', '191', 'dead', 'smps repair', 'par light lpc007 h', '', '350.00', '0.00', '35.00', '0', '5', '2026-01-19 11:53:09', '2026-01-19 13:19:11', '2026-01-19 13:18:59');
INSERT INTO `transaction_list` VALUES ('666', '4', '1', '2026011902', '27833', '192', 'Blinking ', 'new adapter', 'Dmx 512 ', '', '150.00', '0.00', '0.00', '0', '5', '2026-01-19 16:37:03', '2026-01-20 15:32:20', '2026-01-20 15:32:20');
INSERT INTO `transaction_list` VALUES ('667', '4', '1', '2026011903', '27834', '192', 'Fader ', '', 'Dmx 192', '', '0.00', '0.00', '0.00', '0', '0', '2026-01-19 16:37:49', '2026-01-19 16:37:49', '');
INSERT INTO `transaction_list` VALUES ('668', '4', '2', '2026011904', '27835', '19', 'No Lamp', '27369 isme philips 300w lamp dala hai
', 'Sharpy Saif', '', '3500.00', '0.00', '0.00', '0', '5', '2026-01-19 19:34:46', '2026-01-19 19:48:11', '2026-01-19 19:37:57');
INSERT INTO `transaction_list` VALUES ('669', '4', '1', '2026012001', '27836', '51', 'error', '', 'spro sparkle ', '', '450.00', '0.00', '45.00', '0', '5', '2026-01-20 14:15:05', '2026-01-20 14:15:14', '2026-01-20 14:15:14');
INSERT INTO `transaction_list` VALUES ('670', '3', '2', '2026012002', '27837', '61', 'Air kam jyada', '', 'Smd mechanic 857w yellow blue colour ', '', '300.00', '0.00', '0.00', '0', '2', '2026-01-20 17:00:12', '2026-01-26 12:56:01', '');
INSERT INTO `transaction_list` VALUES ('671', '3', '1', '2026012003', '27838', '194', 'Display sofware issue ', '', 'Sharpy 10r axix v2', '', '0.00', '0.00', '0.00', '0', '0', '2026-01-20 18:36:59', '2026-01-20 18:36:59', '');
INSERT INTO `transaction_list` VALUES ('672', '4', '1', '2026012004', '27839', '17', 'jam x', 'Lock sahi kiya ', 'Sharpy Stan 12r', '', '1500.00', '0.00', '150.00', '0', '5', '2026-01-20 19:43:00', '2026-01-21 16:18:29', '2026-01-21 16:18:29');
INSERT INTO `transaction_list` VALUES ('673', '4', '1', '2026012005', '27840', '17', 'belt jam Y', 'Belt 555 ,ancoder', 'Sharpy Stan 12r', '', '1500.00', '0.00', '150.00', '0', '5', '2026-01-20 19:44:50', '2026-01-21 16:18:18', '2026-01-21 16:18:18');
INSERT INTO `transaction_list` VALUES ('674', '4', '2', '2026012006', '27841', '17', 'Dead', 'Power cable ', 'par log 007', '', '300.00', '0.00', '0.00', '0', '5', '2026-01-20 19:48:02', '2026-01-23 19:40:40', '2026-01-23 19:40:40');
INSERT INTO `transaction_list` VALUES ('675', '4', '2', '2026012007', '27842', '17', 'colour', 'Service card button', 'par log 007', '', '300.00', '0.00', '0.00', '0', '5', '2026-01-20 19:48:02', '2026-01-23 19:40:49', '2026-01-23 19:40:49');
INSERT INTO `transaction_list` VALUES ('677', '4', '2', '2026012008', '27844', '17', 'Fader', '4 fedar dale h', 'DMX 1024 Stan', '', '600.00', '0.00', '0.00', '0', '5', '2026-01-20 19:50:18', '2026-01-21 16:18:03', '2026-01-21 16:18:03');
INSERT INTO `transaction_list` VALUES ('678', '4', '2', '2026012009', '27843', '17', 'Dead', 'Smps card repair', 'Par Light lpc007', '', '300.00', '0.00', '0.00', '0', '5', '2026-01-20 19:52:02', '2026-01-23 19:40:27', '2026-01-23 19:40:27');
INSERT INTO `transaction_list` VALUES ('679', '4', '2', '2025041501', '26272', '196', 'Dead', '', 'sharpy BSM', '', '0.00', '0.00', '0.00', '0', '0', '2025-04-15 15:28:00', '2026-01-21 15:29:13', '');
INSERT INTO `transaction_list` VALUES ('680', '3', '2', '2026012101', '27845', '68', 'Ek side bubble ', 'Q fan blower ', 'Bubble machine sse 2eyes ', '', '800.00', '0.00', '0.00', '0', '5', '2026-01-21 16:03:09', '2026-01-21 17:43:56', '2026-01-21 17:43:37');
INSERT INTO `transaction_list` VALUES ('681', '4', '1', '2026012102', '27846', '2', '2 light khadi hain', '', '7 Eye Par', '', '500.00', '0.00', '50.00', '0', '5', '2026-01-21 20:09:41', '2026-01-22 13:09:49', '2026-01-22 13:09:28');
INSERT INTO `transaction_list` VALUES ('682', '4', '1', '2026012103', '27847', '197', 'dead', '', 'controller unit', '', '0.00', '0.00', '0.00', '0', '5', '2026-01-21 20:38:10', '2026-01-29 20:08:44', '2026-01-29 20:08:00');
INSERT INTO `transaction_list` VALUES ('683', '4', '1', '2026012104', '27848', '198', 'button not works and hang abnormally', '', 'Dmx 1024 money light', '', '1500.00', '0.00', '150.00', '0', '5', '2026-01-21 21:00:32', '2026-01-24 20:12:56', '2026-01-24 20:12:56');
INSERT INTO `transaction_list` VALUES ('684', '4', '1', '2026012201', '27849', '171', 'not moving ', 'Motor Jam due to some black substance ', 'Retro fan ', '', '500.00', '0.00', '50.00', '0', '5', '2026-01-22 11:04:41', '2026-01-22 18:41:37', '2026-01-22 18:41:37');
INSERT INTO `transaction_list` VALUES ('685', '4', '1', '2026012202', '27850', '63', 'Broken ', '', 'SharpyMonster 650', '', '1500.00', '0.00', '150.00', '0', '2', '2026-01-22 13:23:25', '2026-01-23 15:55:58', '2026-01-23 15:54:55');
INSERT INTO `transaction_list` VALUES ('686', '4', '1', '2026012203', '27851', '63', 'Broken ', '', 'SharpyMonster 650', '', '1500.00', '0.00', '150.00', '0', '2', '2026-01-22 13:23:25', '2026-01-25 12:18:05', '2026-01-25 12:17:00');
INSERT INTO `transaction_list` VALUES ('687', '3', '2', '2026012204', '27852', '199', 'Y jamm ', 'Motor repair', '10r yellow ', '', '1500.00', '0.00', '0.00', '0', '5', '2026-01-22 16:18:51', '2026-01-22 18:33:45', '2026-01-22 18:33:26');
INSERT INTO `transaction_list` VALUES ('688', '4', '1', '2025090701', '26859', '192', 'Dead', '10 fader and service', 'DMX 240', '26859', '1250.00', '0.00', '25.00', '0', '5', '2025-09-07 19:02:00', '2026-01-22 19:05:14', '2026-01-22 19:05:14');
INSERT INTO `transaction_list` VALUES ('689', '3', '2', '2026012301', '27853', '88', 'Side lock lamp toota h', 'Lock Broken and new Lamp', 'Sharpy 12R', '', '4500.00', '0.00', '0.00', '0', '5', '2026-01-23 13:25:03', '2026-01-25 12:45:23', '2026-01-25 12:45:00');
INSERT INTO `transaction_list` VALUES ('690', '4', '2', '2025092301', '27054', '134', 'Dead', 'New Card single coil', 'Par Light Lpc007', 'delivered', '450.00', '0.00', '0.00', '0', '5', '2025-09-23 17:50:00', '2026-01-23 17:52:39', '2026-01-23 17:52:39');
INSERT INTO `transaction_list` VALUES ('691', '3', '2', '2026012302', '27854', '18', 'Heater load nhi ho rha h ', '', 'Sparkle jia sping ', '', '0.00', '0.00', '0.00', '0', '0', '2026-01-23 18:56:49', '2026-01-23 18:56:49', '');
INSERT INTO `transaction_list` VALUES ('692', '3', '2', '2026012303', '27855', '18', 'Dead ', 'Heater lagaya h ', 'Sparkle moka ', '', '3000.00', '0.00', '0.00', '0', '5', '2026-01-23 18:58:10', '2026-01-30 17:17:09', '2026-01-30 17:17:00');
INSERT INTO `transaction_list` VALUES ('693', '3', '2', '2026012304', '27856', '18', 'Dead ', 'Service moter jam thi ', 'Sparkle moka ', '', '1500.00', '0.00', '0.00', '0', '5', '2026-01-23 18:58:10', '2026-01-30 17:16:32', '2026-01-30 17:16:00');
INSERT INTO `transaction_list` VALUES ('694', '3', '2', '2026012305', '27857', '18', 'Dead ', '', 'Sparkle spro ', '', '0.00', '0.00', '0.00', '0', '0', '2026-01-23 18:58:10', '2026-01-23 19:32:36', '');
INSERT INTO `transaction_list` VALUES ('695', '3', '2', '2026012306', '27858', '18', 'Dead ', 'Board issue ', 'Sparkle s pro ', '', '1500.00', '0.00', '0.00', '0', '5', '2026-01-23 18:58:10', '2026-01-30 17:16:18', '2026-01-30 17:16:00');
INSERT INTO `transaction_list` VALUES ('696', '3', '2', '2026012401', '27859', '200', 'Smoke nhi aa rha h ', 'pump change client hi pump la kar diye hte', 'Smoke 2000', '', '300.00', '0.00', '0.00', '0', '5', '2026-01-24 17:31:11', '2026-01-24 20:26:25', '2026-01-24 20:26:25');
INSERT INTO `transaction_list` VALUES ('697', '4', '1', '2026012501', '27860', '113', 'no heat', 'Relay lga h ', 'seperator ', '', '350.00', '0.00', '35.00', '0', '2', '2026-01-25 12:03:12', '2026-01-26 12:54:56', '');
INSERT INTO `transaction_list` VALUES ('698', '3', '2', '2026012502', '27861', '201', 'Communication ', 'Side card repair', '10r yellow ', '', '2000.00', '0.00', '0.00', '0', '5', '2026-01-25 15:33:32', '2026-01-26 19:34:13', '2026-01-26 19:34:00');
INSERT INTO `transaction_list` VALUES ('699', '4', '1', '2026012601', '27862', '53', 'low Lamp', 'Gobo sensor failed', 'Sharpy 10r axis ', '', '1000.00', '0.00', '100.00', '0', '5', '2026-01-26 15:34:16', '2026-01-26 19:36:34', '2026-01-26 19:36:00');
INSERT INTO `transaction_list` VALUES ('700', '3', '1', '2026012602', '27863', '202', 'Error 650', 'Sensor faulty and traic short', 'Sme sparkle ', '', '800.00', '0.00', '80.00', '0', '5', '2026-01-26 17:45:14', '2026-01-26 18:36:26', '2026-01-26 18:36:00');
INSERT INTO `transaction_list` VALUES ('701', '4', '2', '2026012603', '27864', '122', 'Dead', '', 'Sharpy BSM Beast ', '', '1600.00', '0.00', '0.00', '0', '5', '2026-01-26 18:42:56', '2026-01-26 19:39:11', '2026-01-26 19:39:00');
INSERT INTO `transaction_list` VALUES ('702', '4', '1', '2026012701', '27865', '203', 'Dead', 'Wireing card se moter ki poori tooti thi 
Fan lamp', 'beam 200 orange ', '', '1500.00', '0.00', '150.00', '0', '5', '2026-01-27 11:19:45', '2026-01-28 21:14:06', '2026-01-28 21:14:00');
INSERT INTO `transaction_list` VALUES ('703', '4', '1', '2026012702', '27866', '203', 'no lamp', 'New lamp', 'beam 280', '', '3000.00', '0.00', '0.00', '0', '5', '2026-01-27 11:19:45', '2026-01-28 21:02:24', '2026-01-28 21:02:00');
INSERT INTO `transaction_list` VALUES ('704', '4', '1', '2026012703', '27867', '203', ' broken ', '', 'Stan eco', '', '2000.00', '0.00', '200.00', '0', '5', '2026-01-27 11:19:45', '2026-01-28 20:41:32', '2026-01-28 20:41:00');
INSERT INTO `transaction_list` VALUES ('705', '4', '1', '2026012704', '27868', '203', 'broken ', '', 'beam 280 blue ', '', '0.00', '0.00', '0.00', '0', '0', '2026-01-27 11:19:45', '2026-01-27 11:19:45', '');
INSERT INTO `transaction_list` VALUES ('706', '4', '1', '2026012705', '27869', '203', 'broken ', '', 'Stan eco', '', '0.00', '0.00', '0.00', '0', '0', '2026-01-27 11:19:45', '2026-01-27 11:19:45', '');
INSERT INTO `transaction_list` VALUES ('707', '4', '1', '2026012706', '27870', '203', 'Broken ', '', 'sharpy blue rim', '', '0.00', '0.00', '0.00', '0', '0', '2026-01-27 11:19:45', '2026-01-27 11:19:45', '');
INSERT INTO `transaction_list` VALUES ('708', '4', '1', '2026012707', '27871', '203', 'Dead ', 'Smps repair', 'Stan eco', '', '1500.00', '0.00', '150.00', '0', '5', '2026-01-27 11:19:45', '2026-01-28 21:24:48', '2026-01-28 21:24:00');
INSERT INTO `transaction_list` VALUES ('709', '4', '1', '2026012708', '27872', '203', 'Dead ', 'Testing me ok hai sms address 121 tha', 'Stan eco ', '', '0.00', '0.00', '0.00', '0', '5', '2026-01-27 11:19:45', '2026-01-28 21:29:57', '2026-01-28 21:29:00');
INSERT INTO `transaction_list` VALUES ('710', '4', '1', '2026012709', '27873', '203', 'broken ', '', 'Beam 280', '', '2000.00', '0.00', '200.00', '0', '5', '2026-01-27 11:19:45', '2026-01-28 20:54:08', '2026-01-28 20:54:00');
INSERT INTO `transaction_list` VALUES ('711', '4', '1', '2026012710', '27874', '203', 'broken ', 'Fuse socket side lock ', 'beam 280 ', '', '1500.00', '0.00', '150.00', '0', '5', '2026-01-27 11:19:45', '2026-01-28 21:29:14', '2026-01-28 21:29:00');
INSERT INTO `transaction_list` VALUES ('712', '4', '1', '2026012711', '27875', '203', 'Dead', 'Neeche ka lock    power button ', 'beam 280 blue ', '', '1500.00', '0.00', '150.00', '0', '5', '2026-01-27 11:19:45', '2026-01-28 20:37:10', '2026-01-28 20:37:00');
INSERT INTO `transaction_list` VALUES ('713', '4', '1', '2026012712', '27876', '203', 'No Lamp', 'Display jala hua hai, lamp short hai', 'beam280 orange ', '', '3000.00', '0.00', '0.00', '0', '5', '2026-01-27 11:19:45', '2026-01-28 20:46:56', '2026-01-28 20:46:00');
INSERT INTO `transaction_list` VALUES ('714', '3', '1', '2026012713', '27877', '51', 'Slider butten ', '', 'Dmx 1024 stan ', '', '800.00', '0.00', '80.00', '0', '5', '2026-01-27 14:58:16', '2026-02-02 17:04:53', '2026-02-02 17:04:00');
INSERT INTO `transaction_list` VALUES ('715', '4', '1', '2026012714', '27878', '34', 'side card', 'Card pahle diye the for repair', 'Sharpy 10r axis', '', '0.00', '0.00', '0.00', '0', '0', '2026-01-27 18:02:04', '2026-01-27 18:02:04', '');
INSERT INTO `transaction_list` VALUES ('716', '4', '1', '2026012715', '27879', '204', '24v missing', '', 'power control plc', '', '500.00', '0.00', '50.00', '0', '5', '2026-01-27 18:18:28', '2026-01-27 19:50:42', '2026-01-27 19:50:42');
INSERT INTO `transaction_list` VALUES ('717', '4', '2', '2026012801', '27880', '205', 'x jammed', 'X lock bolt and service', 'Sharp 12r ', '', '1500.00', '0.00', '0.00', '0', '5', '2026-01-28 12:26:13', '2026-01-28 17:02:15', '2026-01-28 17:02:00');
INSERT INTO `transaction_list` VALUES ('718', '4', '1', '2026012802', '27881', '64', 'lamp gone', 'Igniter repair ', 'monster king 350', '', '4500.00', '0.00', '150.00', '0', '5', '2026-01-28 12:50:10', '2026-01-28 17:05:16', '2026-01-28 16:51:00');
INSERT INTO `transaction_list` VALUES ('719', '4', '1', '2026012803', '27882', '64', 'lamp', '', 'monster 350', '', '0.00', '0.00', '0.00', '0', '5', '2026-01-28 12:50:10', '2026-01-28 16:50:33', '2026-01-28 16:50:00');
INSERT INTO `transaction_list` VALUES ('720', '4', '1', '2026012804', '27883', '64', 'force low', '', 'laser stan 5w', '', '0.00', '0.00', '0.00', '0', '5', '2026-01-28 12:50:10', '2026-01-28 16:50:49', '2026-01-28 16:50:00');
INSERT INTO `transaction_list` VALUES ('721', '4', '1', '2026012805', '27884', '124', 'Dead', 'None', 'Nel remover', '', '0.00', '0.00', '0.00', '0', '5', '2026-01-28 15:38:36', '2026-01-31 19:46:47', '2026-01-31 19:46:00');
INSERT INTO `transaction_list` VALUES ('722', '4', '1', '2026012806', '27885', '46', 'hang ho raha hai', '', 'mini pearl 1024 stan black peti', '', '0.00', '0.00', '0.00', '0', '5', '2026-01-28 17:51:42', '2026-01-28 22:25:12', '2026-01-28 22:25:00');
INSERT INTO `transaction_list` VALUES ('723', '4', '1', '2026012807', '27886', '46', 'unknown', '', 'Dmx 1024 red peti', '', '0.00', '0.00', '0.00', '0', '0', '2026-01-28 17:51:42', '2026-01-28 17:51:42', '');
INSERT INTO `transaction_list` VALUES ('724', '4', '1', '2026012808', '27887', '46', 'No lamp', '', 'sharpy stan 12r', '', '500.00', '0.00', '50.00', '0', '5', '2026-01-28 17:51:42', '2026-01-29 11:42:02', '2026-01-28 21:00:00');
INSERT INTO `transaction_list` VALUES ('725', '4', '1', '2026012809', '27888', '46', 'Dead', 'SMPS Short', 'Sharpy stan 12r', '', '1500.00', '0.00', '150.00', '0', '5', '2026-01-28 17:51:42', '2026-01-29 11:41:30', '2026-01-28 21:00:00');
INSERT INTO `transaction_list` VALUES ('726', '4', '1', '2026012810', '27889', '122', 'half dead', 'Khula aaya hai', 'strobe money light', '', '1500.00', '0.00', '150.00', '0', '5', '2026-01-28 22:24:29', '2026-02-01 19:44:48', '2026-02-01 19:44:00');
INSERT INTO `transaction_list` VALUES ('727', '4', '1', '2026012901', '27890', '206', 'Dead', 'Supply short 6268182805 prince', 'Dmx 1024 bpro', '', '1100.00', '0.00', '110.00', '0', '5', '2026-01-29 17:21:35', '2026-01-31 16:39:53', '2026-01-31 16:39:00');
INSERT INTO `transaction_list` VALUES ('728', '4', '2', '2025091301', '26890', '207', 'Dead', 'Fan lence smps', 'Par Light lpc007 H', '26890', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 12:47:00', '2026-01-30 12:51:03', '');
INSERT INTO `transaction_list` VALUES ('729', '4', '2', '2025091302', '26891', '207', 'Dead', 'lence', 'Par Light lpc007 H', '', '320.00', '0.00', '0.00', '0', '0', '2025-09-13 12:52:00', '2026-01-30 12:55:04', '');
INSERT INTO `transaction_list` VALUES ('730', '4', '2', '2025091303', '26892', '207', 'Dead', '', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 12:55:00', '2026-01-30 13:01:56', '');
INSERT INTO `transaction_list` VALUES ('731', '4', '2', '2025091304', '26893', '207', 'Dead', 'lence', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 13:02:00', '2026-01-30 13:03:39', '');
INSERT INTO `transaction_list` VALUES ('732', '4', '2', '2025091305', '26894', '207', 'Dead', '', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 13:11:00', '2026-01-30 13:14:21', '');
INSERT INTO `transaction_list` VALUES ('733', '4', '2', '2025091306', '26895', '207', 'Dead', '', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 13:14:00', '2026-01-30 13:15:26', '');
INSERT INTO `transaction_list` VALUES ('734', '4', '2', '2025091307', '26896', '207', 'Dead', '', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 13:15:00', '2026-01-30 13:16:36', '');
INSERT INTO `transaction_list` VALUES ('735', '4', '2', '2025091308', '26897', '207', 'Dead', '', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 13:16:00', '2026-01-30 13:17:37', '');
INSERT INTO `transaction_list` VALUES ('736', '4', '2', '2025091309', '26898', '207', 'Dead', '', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 13:17:00', '2026-01-30 13:18:35', '');
INSERT INTO `transaction_list` VALUES ('737', '4', '2', '2025091310', '26899', '207', 'Dead', '', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 13:18:00', '2026-01-30 13:19:54', '');
INSERT INTO `transaction_list` VALUES ('738', '4', '2', '2025091311', '26900', '207', 'Dead', '', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 13:20:00', '2026-01-30 13:22:09', '');
INSERT INTO `transaction_list` VALUES ('739', '4', '2', '2025091312', '26901', '207', 'Dead', '', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 13:22:00', '2026-01-30 13:23:24', '');
INSERT INTO `transaction_list` VALUES ('740', '4', '2', '2025091313', '26902', '207', 'Dead', '', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 13:23:00', '2026-01-30 13:24:28', '');
INSERT INTO `transaction_list` VALUES ('741', '4', '2', '2025091314', '26903', '207', 'Dead', '', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 13:24:00', '2026-01-30 13:25:29', '');
INSERT INTO `transaction_list` VALUES ('742', '4', '2', '2025091315', '26904', '207', 'Dead', '', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 13:25:00', '2026-01-30 13:26:40', '');
INSERT INTO `transaction_list` VALUES ('743', '4', '2', '2025091316', '26905', '207', 'Dead', '', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 13:26:00', '2026-01-30 13:27:39', '');
INSERT INTO `transaction_list` VALUES ('744', '4', '2', '2025091317', '26906', '207', 'Dead', '', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 13:27:00', '2026-01-30 13:28:37', '');
INSERT INTO `transaction_list` VALUES ('745', '4', '2', '2025091318', '26907', '207', 'Dead', '', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 13:28:00', '2026-01-30 13:29:45', '');
INSERT INTO `transaction_list` VALUES ('746', '4', '2', '2025091319', '26908', '207', 'Dead', '', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 13:29:00', '2026-01-30 13:30:37', '');
INSERT INTO `transaction_list` VALUES ('747', '4', '2', '2025091320', '26909', '207', 'Dead', '', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 13:30:00', '2026-01-30 13:31:32', '');
INSERT INTO `transaction_list` VALUES ('748', '4', '2', '2025091321', '26910', '207', 'Dead', '', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 13:31:00', '2026-01-30 13:32:25', '');
INSERT INTO `transaction_list` VALUES ('749', '4', '2', '2025091322', '26911', '207', 'Dead', '', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 13:32:00', '2026-01-30 13:33:25', '');
INSERT INTO `transaction_list` VALUES ('750', '4', '2', '2025091323', '26912', '207', 'Dead', '', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 13:33:00', '2026-01-30 13:34:16', '');
INSERT INTO `transaction_list` VALUES ('751', '4', '2', '2025091324', '26913', '207', 'Dead', '', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 13:34:00', '2026-01-30 13:35:27', '');
INSERT INTO `transaction_list` VALUES ('752', '4', '2', '2025091325', '26914', '207', 'Dead', '', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 13:35:00', '2026-01-30 13:36:25', '');
INSERT INTO `transaction_list` VALUES ('753', '4', '2', '2025091326', '26915', '207', 'Dead', '', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 13:36:00', '2026-01-30 13:37:12', '');
INSERT INTO `transaction_list` VALUES ('754', '4', '2', '2025091327', '26916', '207', 'Dead', '', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 13:37:00', '2026-01-30 13:38:33', '');
INSERT INTO `transaction_list` VALUES ('755', '4', '2', '2025091328', '26917', '207', 'Dead', '', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 13:38:00', '2026-01-30 13:39:40', '');
INSERT INTO `transaction_list` VALUES ('756', '4', '2', '2025091329', '26918', '207', 'Dead', '', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 13:39:00', '2026-01-30 13:40:38', '');
INSERT INTO `transaction_list` VALUES ('757', '4', '2', '2025091330', '26919', '207', 'Dead', '', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 13:40:00', '2026-01-30 13:41:38', '');
INSERT INTO `transaction_list` VALUES ('758', '4', '2', '2025091331', '26920', '207', 'Dead', '', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 13:41:00', '2026-01-30 13:42:30', '');
INSERT INTO `transaction_list` VALUES ('759', '4', '2', '2025091332', '26921', '207', 'Dead', '', 'Par Light lpc007 H', '', '0.00', '0.00', '0.00', '0', '0', '2025-09-13 13:42:00', '2026-01-30 13:43:43', '');
INSERT INTO `transaction_list` VALUES ('760', '4', '1', '2026013001', '27891', '149', 'fader broken', '', 'dmx 1024 money light', '', '400.00', '0.00', '40.00', '0', '5', '2026-01-30 16:18:20', '2026-01-30 16:43:02', '2026-01-30 16:42:00');
INSERT INTO `transaction_list` VALUES ('761', '4', '1', '2026013002', '27892', '19', 'lamp flicker', 'New smps  ek fan ', 'sharpy saif', '', '1000.00', '0.00', '100.00', '0', '2', '2026-01-30 17:28:19', '2026-01-31 19:43:47', '');
INSERT INTO `transaction_list` VALUES ('762', '4', '1', '2026013003', '27893', '19', 'lamp gone after half hour', 'Igniter repair smps repair 2 fan ', 'sharpy saif', '', '1000.00', '0.00', '100.00', '0', '2', '2026-01-30 17:28:19', '2026-01-31 19:44:34', '');
INSERT INTO `transaction_list` VALUES ('763', '4', '2', '2026013004', '27894', '185', 'Dead', 'New fan ', 'par Bigdepar', '', '400.00', '0.00', '0.00', '0', '2', '2026-01-30 19:52:00', '2026-02-01 17:13:25', '');
INSERT INTO `transaction_list` VALUES ('764', '4', '2', '2026013005', '27895', '185', 'Dead', 'New tawa new fan ', 'par Bigdepar', '', '900.00', '0.00', '0.00', '0', '2', '2026-01-30 19:53:13', '2026-02-01 16:52:56', '');
INSERT INTO `transaction_list` VALUES ('765', '4', '2', '2026013006', '27896', '185', 'Dead', '', 'par Bigdepar', '', '0.00', '0.00', '0.00', '0', '0', '2026-01-30 19:53:54', '2026-01-30 19:53:54', '');
INSERT INTO `transaction_list` VALUES ('766', '4', '2', '2026013007', '27897', '185', 'Dead', 'New fan new tawa', 'par Bigdepar', '', '900.00', '0.00', '0.00', '0', '2', '2026-01-30 19:54:32', '2026-02-01 15:24:16', '');
INSERT INTO `transaction_list` VALUES ('767', '4', '2', '2026013008', '27898', '185', 'Dead', 'Tawa new fan new ', 'par Bigdepar', '', '900.00', '0.00', '0.00', '0', '2', '2026-01-30 19:55:09', '2026-02-01 16:01:43', '');
INSERT INTO `transaction_list` VALUES ('768', '4', '2', '2026013009', '27899', '185', 'Dead', 'New tawa new fan ', 'par Bigdepar', '', '900.00', '0.00', '0.00', '0', '2', '2026-01-30 19:55:44', '2026-02-01 14:56:33', '');
INSERT INTO `transaction_list` VALUES ('769', '4', '2', '2026013010', '27900', '185', 'Dead', 'Fan new', 'par Bigdepar', '', '400.00', '0.00', '0.00', '0', '2', '2026-01-30 19:56:15', '2026-01-31 13:35:51', '');
INSERT INTO `transaction_list` VALUES ('770', '4', '2', '2026013011', '27901', '185', 'unknown', 'New tawa new fan ', 'par bigdipper', '', '900.00', '0.00', '0.00', '0', '2', '2026-01-30 19:58:02', '2026-02-01 19:22:20', '');
INSERT INTO `transaction_list` VALUES ('771', '4', '2', '2026013012', '27902', '185', 'unknown', '', 'par bigdipper', '', '0.00', '0.00', '0.00', '0', '0', '2026-01-30 19:58:02', '2026-01-30 19:58:02', '');
INSERT INTO `transaction_list` VALUES ('772', '4', '2', '2025041701', '26297', '208', 'Broken', 'full body and spares', 'Sharpy 10R Yellow', '', '5300.00', '0.00', '0.00', '0', '5', '2025-04-17 12:35:00', '2026-01-31 12:42:08', '2025-04-17 12:41:00');
INSERT INTO `transaction_list` VALUES ('773', '4', '2', '2025041702', '26298', '208', 'Broken', 'body repair', 'Sharpy 10R Yellow', '', '2000.00', '0.00', '0.00', '0', '5', '2025-04-17 12:37:00', '2026-01-31 12:43:32', '2025-05-17 12:42:00');
INSERT INTO `transaction_list` VALUES ('774', '4', '2', '2025041703', '26299', '208', 'Broken', 'body repair ', 'Sharpy 10R Yellow new', '', '2000.00', '0.00', '0.00', '0', '5', '2025-04-17 12:38:00', '2026-01-31 12:45:22', '2025-04-17 12:45:00');
INSERT INTO `transaction_list` VALUES ('775', '4', '2', '2025041704', '26300', '208', 'Broken', 'body repair', 'Sharpy 10R Yellow new', '', '2000.00', '0.00', '0.00', '0', '2', '2025-04-17 12:39:00', '2026-01-31 12:46:07', '');
INSERT INTO `transaction_list` VALUES ('776', '4', '', '2026013101', '27903', '100', 'Low voltage', '', 'C-50-5v', '', '0.00', '0.00', '0.00', '0', '5', '2026-01-31 13:03:18', '2026-02-02 12:54:36', '2026-02-01 11:45:00');
INSERT INTO `transaction_list` VALUES ('777', '4', '1', '2026013102', '27904', '100', 'dead', '', 'amps 5v-40a', '', '0.00', '0.00', '0.00', '0', '5', '2026-01-31 13:03:18', '2026-02-02 12:54:53', '2026-02-01 11:45:00');
INSERT INTO `transaction_list` VALUES ('778', '4', '1', '2026013103', '27905', '100', 'dead', '', 'amps 5v 20a', '', '0.00', '0.00', '0.00', '0', '0', '2026-01-31 13:03:18', '2026-01-31 13:03:18', '');
INSERT INTO `transaction_list` VALUES ('779', '4', '1', '2026013104', '27906', '210', 'dead', '', 'yogya and blue', '', '0.00', '0.00', '0.00', '0', '0', '2026-01-31 13:08:09', '2026-01-31 13:08:09', '');
INSERT INTO `transaction_list` VALUES ('780', '3', '2', '2026013105', '27907', '17', '5,6 ek sath chal rha h ', '27844', 'Dmx 1024b stan ', '', '500.00', '0.00', '0.00', '0', '5', '2026-01-31 14:09:02', '2026-01-31 15:49:31', '2026-01-31 15:49:00');
INSERT INTO `transaction_list` VALUES ('781', '3', '2', '2026013106', '27908', '171', 'Pahle bhi ai thi peoble kr rhi h ', 'LAMP FUTA HUA THA NEW Lamp 300wt PH', 'Bsm sharpy ', '', '3000.00', '0.00', '0.00', '0', '5', '2026-01-31 14:19:16', '2026-01-31 15:53:42', '2026-01-31 15:53:00');
INSERT INTO `transaction_list` VALUES ('782', '3', '2', '2026013107', '27909', '171', 'Pahle bhi ban ke gyi h pr peoblem kr rhi h ', 'SOCKET LOOSE', 'sharpy BSM Beast', '', '0.00', '0.00', '0.00', '0', '5', '2026-01-31 14:19:54', '2026-01-31 15:53:51', '2026-01-31 15:53:00');
INSERT INTO `transaction_list` VALUES ('783', '4', '1', '2026013108', '27910', '211', 'slow chek karna hai', 'Vijay panagar', '1024 mk2 stan', '', '700.00', '0.00', '70.00', '0', '5', '2026-01-31 14:38:23', '2026-02-02 19:33:14', '2026-02-02 19:33:00');
INSERT INTO `transaction_list` VALUES ('784', '4', '1', '2026020101', '27911', '213', 'display fault', '26388', 'stan monster king 750', '', '500.00', '0.00', '50.00', '0', '5', '2026-02-01 12:26:11', '2026-02-02 10:52:21', '2026-02-01 18:52:00');
INSERT INTO `transaction_list` VALUES ('785', '4', '1', '2026020102', '27912', '214', 'DMC not working', '', 'Sharpy beam230', '', '1500.00', '0.00', '150.00', '0', '5', '2026-02-01 12:53:39', '2026-02-01 19:53:01', '2026-02-01 19:52:00');
INSERT INTO `transaction_list` VALUES ('786', '3', '2', '2026020103', '27913', '215', 'Heat nhi aa rhi h ', 'Quile new ', 'Smd quick kt 850a+', '', '450.00', '0.00', '0.00', '0', '5', '2026-02-01 13:59:46', '2026-02-02 10:49:38', '2026-02-01 19:49:00');
INSERT INTO `transaction_list` VALUES ('787', '4', '1', '2026020201', '27914', '216', 'dead', '', 'mw rs-25-5 smps', '', '500.00', '0.00', '50.00', '0', '5', '2026-02-02 14:53:58', '2026-02-02 15:07:11', '2026-02-02 15:07:00');
INSERT INTO `transaction_list` VALUES ('788', '4', '1', '2026020202', '27915', '41', 'dead', '', 'sparkle machine', '', '0.00', '0.00', '0.00', '0', '0', '2026-02-02 17:12:23', '2026-02-02 17:12:23', '');
INSERT INTO `transaction_list` VALUES ('789', '4', '1', '2026020203', '27916', '41', ' low spark', '', 'sprake', '', '0.00', '0.00', '0.00', '0', '0', '2026-02-02 17:12:23', '2026-02-02 17:12:23', '');

DROP TABLE IF EXISTS `transaction_products`;
CREATE TABLE `transaction_products` (
  `transaction_id` int(30) NOT NULL,
  `product_id` int(30) NOT NULL,
  `product_name` text DEFAULT NULL,
  `qty` int(11) NOT NULL DEFAULT 0,
  `price` float(15,2) NOT NULL DEFAULT 0.00,
  KEY `transaction_id` (`transaction_id`),
  KEY `service_id` (`product_id`),
  CONSTRAINT `product_id_fk_tp` FOREIGN KEY (`product_id`) REFERENCES `product_list` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `transaction_id_fk_tp` FOREIGN KEY (`transaction_id`) REFERENCES `transaction_list` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `transaction_products` VALUES ('40', '14', '', '1', '1300.00');
INSERT INTO `transaction_products` VALUES ('58', '15', '', '1', '3500.00');
INSERT INTO `transaction_products` VALUES ('49', '16', '', '1', '550.00');
INSERT INTO `transaction_products` VALUES ('77', '6', '', '1', '2300.00');
INSERT INTO `transaction_products` VALUES ('74', '14', '', '1', '1300.00');
INSERT INTO `transaction_products` VALUES ('74', '17', '', '1', '350.00');
INSERT INTO `transaction_products` VALUES ('76', '17', '', '1', '350.00');
INSERT INTO `transaction_products` VALUES ('94', '17', '', '1', '350.00');
INSERT INTO `transaction_products` VALUES ('98', '19', '', '1', '2500.00');
INSERT INTO `transaction_products` VALUES ('113', '20', '', '1', '1500.00');
INSERT INTO `transaction_products` VALUES ('122', '14', '', '1', '1300.00');
INSERT INTO `transaction_products` VALUES ('141', '6', '', '1', '2300.00');
INSERT INTO `transaction_products` VALUES ('142', '6', '', '1', '2300.00');
INSERT INTO `transaction_products` VALUES ('142', '21', '', '1', '2300.00');
INSERT INTO `transaction_products` VALUES ('171', '8', '', '1', '3000.00');
INSERT INTO `transaction_products` VALUES ('171', '6', '', '1', '2300.00');
INSERT INTO `transaction_products` VALUES ('171', '22', '', '1', '270.00');
INSERT INTO `transaction_products` VALUES ('189', '23', '', '1', '450.00');
INSERT INTO `transaction_products` VALUES ('196', '5', '', '1', '2300.00');
INSERT INTO `transaction_products` VALUES ('203', '5', '', '1', '2300.00');
INSERT INTO `transaction_products` VALUES ('210', '10', '', '1', '3500.00');
INSERT INTO `transaction_products` VALUES ('172', '5', '', '1', '2300.00');
INSERT INTO `transaction_products` VALUES ('225', '17', '', '1', '350.00');
INSERT INTO `transaction_products` VALUES ('250', '25', '', '1', '5500.00');
INSERT INTO `transaction_products` VALUES ('284', '8', '', '1', '3000.00');
INSERT INTO `transaction_products` VALUES ('284', '5', '', '1', '2300.00');
INSERT INTO `transaction_products` VALUES ('305', '12', '', '1', '3500.00');
INSERT INTO `transaction_products` VALUES ('311', '18', '', '1', '350.00');
INSERT INTO `transaction_products` VALUES ('322', '5', '', '1', '2300.00');
INSERT INTO `transaction_products` VALUES ('332', '28', '', '1', '700.00');
INSERT INTO `transaction_products` VALUES ('348', '17', '', '1', '350.00');
INSERT INTO `transaction_products` VALUES ('349', '28', '', '1', '700.00');
INSERT INTO `transaction_products` VALUES ('347', '28', '', '1', '700.00');
INSERT INTO `transaction_products` VALUES ('368', '10', '', '1', '3500.00');
INSERT INTO `transaction_products` VALUES ('376', '15', '', '1', '3500.00');
INSERT INTO `transaction_products` VALUES ('377', '10', '', '1', '3500.00');
INSERT INTO `transaction_products` VALUES ('384', '5', '', '1', '2300.00');
INSERT INTO `transaction_products` VALUES ('452', '22', '', '1', '270.00');
INSERT INTO `transaction_products` VALUES ('460', '5', '', '1', '2300.00');
INSERT INTO `transaction_products` VALUES ('459', '5', '', '1', '2300.00');
INSERT INTO `transaction_products` VALUES ('462', '32', '', '10', '100.00');
INSERT INTO `transaction_products` VALUES ('472', '33', '', '1', '200.00');
INSERT INTO `transaction_products` VALUES ('475', '6', '', '1', '2500.00');
INSERT INTO `transaction_products` VALUES ('494', '24', '', '1', '3500.00');
INSERT INTO `transaction_products` VALUES ('539', '5', '', '1', '2500.00');
INSERT INTO `transaction_products` VALUES ('464', '24', '', '1', '2700.00');
INSERT INTO `transaction_products` VALUES ('464', '12', '', '1', '3500.00');
INSERT INTO `transaction_products` VALUES ('464', '20', '', '2', '150.00');
INSERT INTO `transaction_products` VALUES ('544', '7', '', '1', '2300.00');
INSERT INTO `transaction_products` VALUES ('585', '41', '', '1', '180.00');
INSERT INTO `transaction_products` VALUES ('590', '41', '', '1', '950.00');
INSERT INTO `transaction_products` VALUES ('498', '41', '', '1', '100.00');
INSERT INTO `transaction_products` VALUES ('600', '7', '', '1', '2300.00');
INSERT INTO `transaction_products` VALUES ('606', '6', '', '1', '2300.00');
INSERT INTO `transaction_products` VALUES ('606', '7', '', '1', '2300.00');
INSERT INTO `transaction_products` VALUES ('603', '6', '', '1', '2300.00');
INSERT INTO `transaction_products` VALUES ('553', '41', '', '1', '2600.00');
INSERT INTO `transaction_products` VALUES ('554', '41', '', '1', '2600.00');
INSERT INTO `transaction_products` VALUES ('555', '41', '', '1', '2600.00');
INSERT INTO `transaction_products` VALUES ('504', '16', '', '1', '550.00');
INSERT INTO `transaction_products` VALUES ('607', '41', '', '1', '4500.00');
INSERT INTO `transaction_products` VALUES ('641', '16', '', '1', '550.00');
INSERT INTO `transaction_products` VALUES ('639', '16', '', '1', '550.00');
INSERT INTO `transaction_products` VALUES ('638', '16', '', '1', '550.00');
INSERT INTO `transaction_products` VALUES ('632', '16', '', '1', '550.00');
INSERT INTO `transaction_products` VALUES ('631', '16', '', '1', '550.00');
INSERT INTO `transaction_products` VALUES ('623', '16', '', '1', '550.00');
INSERT INTO `transaction_products` VALUES ('615', '16', '', '1', '550.00');
INSERT INTO `transaction_products` VALUES ('614', '16', '', '1', '550.00');
INSERT INTO `transaction_products` VALUES ('609', '16', '', '1', '550.00');
INSERT INTO `transaction_products` VALUES ('608', '16', '', '1', '550.00');
INSERT INTO `transaction_products` VALUES ('642', '16', '', '1', '550.00');
INSERT INTO `transaction_products` VALUES ('666', '41', '', '1', '150.00');
INSERT INTO `transaction_products` VALUES ('668', '8', '', '1', '3000.00');
INSERT INTO `transaction_products` VALUES ('565', '5', '', '1', '2500.00');
INSERT INTO `transaction_products` VALUES ('565', '8', '', '1', '3000.00');
INSERT INTO `transaction_products` VALUES ('637', '16', '', '1', '550.00');
INSERT INTO `transaction_products` VALUES ('688', '32', '', '10', '100.00');
INSERT INTO `transaction_products` VALUES ('690', '41', '', '1', '300.00');
INSERT INTO `transaction_products` VALUES ('299', '21', '', '1', '2300.00');
INSERT INTO `transaction_products` VALUES ('689', '8', '', '1', '3000.00');
INSERT INTO `transaction_products` VALUES ('345', '14', '', '1', '1300.00');
INSERT INTO `transaction_products` VALUES ('701', '27', '', '1', '1600.00');
INSERT INTO `transaction_products` VALUES ('713', '8', '', '1', '3000.00');
INSERT INTO `transaction_products` VALUES ('703', '8', '', '1', '3000.00');
INSERT INTO `transaction_products` VALUES ('718', '8', '', '1', '3000.00');
INSERT INTO `transaction_products` VALUES ('692', '26', '', '1', '2500.00');
INSERT INTO `transaction_products` VALUES ('781', '8', '', '1', '3000.00');
INSERT INTO `transaction_products` VALUES ('786', '33', '', '1', '200.00');
INSERT INTO `transaction_products` VALUES ('768', '16', '', '1', '550.00');
INSERT INTO `transaction_products` VALUES ('766', '16', '', '1', '550.00');
INSERT INTO `transaction_products` VALUES ('767', '16', '', '1', '550.00');
INSERT INTO `transaction_products` VALUES ('764', '16', '', '1', '550.00');
INSERT INTO `transaction_products` VALUES ('770', '16', '', '1', '550.00');

DROP TABLE IF EXISTS `transaction_services`;
CREATE TABLE `transaction_services` (
  `transaction_id` int(30) NOT NULL,
  `service_id` int(30) NOT NULL,
  `service_name` text DEFAULT NULL,
  `price` float(15,2) NOT NULL DEFAULT 0.00,
  KEY `transaction_id` (`transaction_id`),
  KEY `service_id` (`service_id`),
  CONSTRAINT `service_id_fk_ts` FOREIGN KEY (`service_id`) REFERENCES `service_list` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `transaction_id_fk_ts` FOREIGN KEY (`transaction_id`) REFERENCES `transaction_list` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `transaction_services` VALUES ('39', '10', '', '750.00');
INSERT INTO `transaction_services` VALUES ('38', '10', '', '750.00');
INSERT INTO `transaction_services` VALUES ('40', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('42', '2', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('43', '2', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('58', '2', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('60', '2', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('66', '1', '', '2000.00');
INSERT INTO `transaction_services` VALUES ('67', '13', '', '600.00');
INSERT INTO `transaction_services` VALUES ('68', '7', '', '850.00');
INSERT INTO `transaction_services` VALUES ('69', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('45', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('48', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('49', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('50', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('51', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('52', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('53', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('70', '16', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('72', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('73', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('77', '19', '', '700.00');
INSERT INTO `transaction_services` VALUES ('80', '2', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('81', '2', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('90', '20', '', '500.00');
INSERT INTO `transaction_services` VALUES ('74', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('71', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('76', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('75', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('94', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('93', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('98', '22', '', '1000.00');
INSERT INTO `transaction_services` VALUES ('105', '1', '', '2000.00');
INSERT INTO `transaction_services` VALUES ('105', '23', '', '-200.00');
INSERT INTO `transaction_services` VALUES ('114', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('65', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('65', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('64', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('91', '1', '', '2000.00');
INSERT INTO `transaction_services` VALUES ('113', '2', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('115', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('122', '24', '', '350.00');
INSERT INTO `transaction_services` VALUES ('122', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('123', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('124', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('111', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('110', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('133', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('104', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('116', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('118', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('121', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('120', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('112', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('152', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('153', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('154', '19', '', '700.00');
INSERT INTO `transaction_services` VALUES ('163', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('166', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('168', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('156', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('155', '1', '', '2000.00');
INSERT INTO `transaction_services` VALUES ('155', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('161', '19', '', '700.00');
INSERT INTO `transaction_services` VALUES ('158', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('157', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('162', '19', '', '700.00');
INSERT INTO `transaction_services` VALUES ('160', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('140', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('141', '19', '', '700.00');
INSERT INTO `transaction_services` VALUES ('149', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('136', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('137', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('138', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('142', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('148', '1', '', '2000.00');
INSERT INTO `transaction_services` VALUES ('171', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('150', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('87', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('87', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('135', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('129', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('132', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('130', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('139', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('146', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('146', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('177', '1', '', '2000.00');
INSERT INTO `transaction_services` VALUES ('177', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('182', '22', '', '1000.00');
INSERT INTO `transaction_services` VALUES ('176', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('180', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('179', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('178', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('143', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('144', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('145', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('192', '22', '', '1000.00');
INSERT INTO `transaction_services` VALUES ('192', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('189', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('196', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('188', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('193', '22', '', '1000.00');
INSERT INTO `transaction_services` VALUES ('194', '22', '', '1000.00');
INSERT INTO `transaction_services` VALUES ('202', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('203', '19', '', '700.00');
INSERT INTO `transaction_services` VALUES ('210', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('211', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('88', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('86', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('84', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('83', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('85', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('85', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('218', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('219', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('220', '1', '', '2000.00');
INSERT INTO `transaction_services` VALUES ('220', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('221', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('172', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('222', '19', '', '700.00');
INSERT INTO `transaction_services` VALUES ('223', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('223', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('216', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('214', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('213', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('224', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('225', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('198', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('252', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('250', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('251', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('246', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('231', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('231', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('231', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('228', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('229', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('230', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('232', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('233', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('234', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('235', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('236', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('237', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('238', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('239', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('240', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('241', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('242', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('243', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('244', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('245', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('254', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('255', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('256', '22', '', '1000.00');
INSERT INTO `transaction_services` VALUES ('262', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('262', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('261', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('257', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('264', '1', '', '2000.00');
INSERT INTO `transaction_services` VALUES ('264', '22', '', '1000.00');
INSERT INTO `transaction_services` VALUES ('268', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('269', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('226', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('227', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('283', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('284', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('284', '23', '', '-200.00');
INSERT INTO `transaction_services` VALUES ('273', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('272', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('276', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('270', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('274', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('271', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('275', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('289', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('291', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('292', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('293', '1', '', '2000.00');
INSERT INTO `transaction_services` VALUES ('293', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('294', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('295', '22', '', '1000.00');
INSERT INTO `transaction_services` VALUES ('295', '1', '', '2000.00');
INSERT INTO `transaction_services` VALUES ('295', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('298', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('310', '1', '', '2000.00');
INSERT INTO `transaction_services` VALUES ('310', '25', '', '2500.00');
INSERT INTO `transaction_services` VALUES ('312', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('311', '13', '', '600.00');
INSERT INTO `transaction_services` VALUES ('311', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('319', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('318', '19', '', '700.00');
INSERT INTO `transaction_services` VALUES ('324', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('325', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('326', '5', '', '2000.00');
INSERT INTO `transaction_services` VALUES ('323', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('322', '19', '', '700.00');
INSERT INTO `transaction_services` VALUES ('321', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('44', '25', '', '2500.00');
INSERT INTO `transaction_services` VALUES ('331', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('330', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('329', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('332', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('334', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('336', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('335', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('333', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('338', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('301', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('300', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('343', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('174', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('342', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('339', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('350', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('351', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('352', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('302', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('348', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('354', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('175', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('356', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('349', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('355', '19', '', '700.00');
INSERT INTO `transaction_services` VALUES ('355', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('357', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('360', '19', '', '700.00');
INSERT INTO `transaction_services` VALUES ('359', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('359', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('361', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('296', '19', '', '700.00');
INSERT INTO `transaction_services` VALUES ('296', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('288', '24', '', '350.00');
INSERT INTO `transaction_services` VALUES ('363', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('358', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('62', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('61', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('159', '22', '', '1000.00');
INSERT INTO `transaction_services` VALUES ('159', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('369', '13', '', '600.00');
INSERT INTO `transaction_services` VALUES ('367', '5', '', '2000.00');
INSERT INTO `transaction_services` VALUES ('368', '1', '', '2000.00');
INSERT INTO `transaction_services` VALUES ('368', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('371', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('372', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('372', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('373', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('374', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('375', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('344', '1', '', '2000.00');
INSERT INTO `transaction_services` VALUES ('376', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('378', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('377', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('173', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('380', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('380', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('386', '11', '', '250.00');
INSERT INTO `transaction_services` VALUES ('387', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('398', '15', '', '400.00');
INSERT INTO `transaction_services` VALUES ('385', '19', '', '700.00');
INSERT INTO `transaction_services` VALUES ('384', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('384', '13', '', '600.00');
INSERT INTO `transaction_services` VALUES ('383', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('382', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('381', '18', '', '1000.00');
INSERT INTO `transaction_services` VALUES ('401', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('402', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('405', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('404', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('403', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('439', '15', '', '400.00');
INSERT INTO `transaction_services` VALUES ('443', '22', '', '800.00');
INSERT INTO `transaction_services` VALUES ('444', '1', '', '3500.00');
INSERT INTO `transaction_services` VALUES ('450', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('435', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('436', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('451', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('452', '14', '', '230.00');
INSERT INTO `transaction_services` VALUES ('458', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('460', '22', '', '700.00');
INSERT INTO `transaction_services` VALUES ('459', '19', '', '700.00');
INSERT INTO `transaction_services` VALUES ('462', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('463', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('461', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('465', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('472', '11', '', '150.00');
INSERT INTO `transaction_services` VALUES ('470', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('475', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('495', '1', '', '2000.00');
INSERT INTO `transaction_services` VALUES ('493', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('445', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('446', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('447', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('449', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('448', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('41', '12', '', '650.00');
INSERT INTO `transaction_services` VALUES ('494', '17', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('524', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('525', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('526', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('521', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('317', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('522', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('507', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('529', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('531', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('530', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('523', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('533', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('532', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('535', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('320', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('362', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('536', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('537', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('538', '19', '', '800.00');
INSERT INTO `transaction_services` VALUES ('539', '3', '', '500.00');
INSERT INTO `transaction_services` VALUES ('97', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('278', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('466', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('540', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('541', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('464', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('467', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('544', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('400', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('399', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('128', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('280', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('134', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('508', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('510', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('506', '14', '', '400.00');
INSERT INTO `transaction_services` VALUES ('515', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('511', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('421', '18', '', '850.00');
INSERT INTO `transaction_services` VALUES ('547', '17', '', '500.00');
INSERT INTO `transaction_services` VALUES ('550', '2', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('551', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('560', '22', '', '800.00');
INSERT INTO `transaction_services` VALUES ('564', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('573', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('572', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('562', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('566', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('574', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('567', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('585', '14', '', '220.00');
INSERT INTO `transaction_services` VALUES ('590', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('570', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('501', '14', '', '400.00');
INSERT INTO `transaction_services` VALUES ('498', '14', '', '400.00');
INSERT INTO `transaction_services` VALUES ('592', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('46', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('47', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('593', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('594', '18', '', '8500.00');
INSERT INTO `transaction_services` VALUES ('597', '25', '', '250.00');
INSERT INTO `transaction_services` VALUES ('595', '22', '', '1000.00');
INSERT INTO `transaction_services` VALUES ('599', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('561', '18', '', '1700.00');
INSERT INTO `transaction_services` VALUES ('645', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('600', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('606', '22', '', '900.00');
INSERT INTO `transaction_services` VALUES ('605', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('604', '18', '', '800.00');
INSERT INTO `transaction_services` VALUES ('603', '22', '', '700.00');
INSERT INTO `transaction_services` VALUES ('602', '18', '', '800.00');
INSERT INTO `transaction_services` VALUES ('601', '18', '', '800.00');
INSERT INTO `transaction_services` VALUES ('297', '17', '', '300.00');
INSERT INTO `transaction_services` VALUES ('653', '1', '', '2000.00');
INSERT INTO `transaction_services` VALUES ('663', '24', '', '0.00');
INSERT INTO `transaction_services` VALUES ('629', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('558', '24', '', '350.00');
INSERT INTO `transaction_services` VALUES ('613', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('553', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('554', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('555', '3', '', '500.00');
INSERT INTO `transaction_services` VALUES ('556', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('559', '22', '', '800.00');
INSERT INTO `transaction_services` VALUES ('664', '25', '', '500.00');
INSERT INTO `transaction_services` VALUES ('518', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('520', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('517', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('516', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('514', '17', '', '250.00');
INSERT INTO `transaction_services` VALUES ('513', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('512', '15', '', '400.00');
INSERT INTO `transaction_services` VALUES ('505', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('504', '17', '', '250.00');
INSERT INTO `transaction_services` VALUES ('503', '15', '', '500.00');
INSERT INTO `transaction_services` VALUES ('502', '11', '', '450.00');
INSERT INTO `transaction_services` VALUES ('607', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('665', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('640', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('636', '15', '', '400.00');
INSERT INTO `transaction_services` VALUES ('641', '24', '', '350.00');
INSERT INTO `transaction_services` VALUES ('639', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('638', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('632', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('631', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('623', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('621', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('615', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('614', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('609', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('608', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('642', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('668', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('669', '21', '', '450.00');
INSERT INTO `transaction_services` VALUES ('414', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('627', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('379', '22', '', '800.00');
INSERT INTO `transaction_services` VALUES ('565', '3', '', '500.00');
INSERT INTO `transaction_services` VALUES ('637', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('634', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('672', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('673', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('677', '21', '', '600.00');
INSERT INTO `transaction_services` VALUES ('680', '22', '', '800.00');
INSERT INTO `transaction_services` VALUES ('674', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('684', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('681', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('678', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('675', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('582', '21', '', '3000.00');
INSERT INTO `transaction_services` VALUES ('687', '2', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('688', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('686', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('685', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('690', '14', '', '150.00');
INSERT INTO `transaction_services` VALUES ('299', '19', '', '700.00');
INSERT INTO `transaction_services` VALUES ('689', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('345', '11', '', '200.00');
INSERT INTO `transaction_services` VALUES ('583', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('695', '16', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('546', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('683', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('696', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('697', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('670', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('698', '1', '', '2000.00');
INSERT INTO `transaction_services` VALUES ('659', '13', '', '600.00');
INSERT INTO `transaction_services` VALUES ('693', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('699', '22', '', '1000.00');
INSERT INTO `transaction_services` VALUES ('700', '22', '', '800.00');
INSERT INTO `transaction_services` VALUES ('711', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('712', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('708', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('702', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('716', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('717', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('453', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('718', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('704', '1', '', '2000.00');
INSERT INTO `transaction_services` VALUES ('724', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('725', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('710', '1', '', '2000.00');
INSERT INTO `transaction_services` VALUES ('729', '17', '', '320.00');
INSERT INTO `transaction_services` VALUES ('643', '21', '', '900.00');
INSERT INTO `transaction_services` VALUES ('644', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('760', '24', '', '400.00');
INSERT INTO `transaction_services` VALUES ('692', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('772', '2', '', '5300.00');
INSERT INTO `transaction_services` VALUES ('773', '2', '', '2000.00');
INSERT INTO `transaction_services` VALUES ('774', '2', '', '2000.00');
INSERT INTO `transaction_services` VALUES ('775', '2', '', '2000.00');
INSERT INTO `transaction_services` VALUES ('616', '15', '', '300.00');
INSERT INTO `transaction_services` VALUES ('769', '11', '', '400.00');
INSERT INTO `transaction_services` VALUES ('780', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('727', '22', '', '1100.00');
INSERT INTO `transaction_services` VALUES ('761', '22', '', '1000.00');
INSERT INTO `transaction_services` VALUES ('762', '9', '', '1000.00');
INSERT INTO `transaction_services` VALUES ('784', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('786', '14', '', '250.00');
INSERT INTO `transaction_services` VALUES ('768', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('766', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('767', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('764', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('763', '15', '', '400.00');
INSERT INTO `transaction_services` VALUES ('770', '17', '', '350.00');
INSERT INTO `transaction_services` VALUES ('726', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('785', '18', '', '1500.00');
INSERT INTO `transaction_services` VALUES ('787', '21', '', '500.00');
INSERT INTO `transaction_services` VALUES ('714', '22', '', '800.00');
INSERT INTO `transaction_services` VALUES ('783', '19', '', '700.00');

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int(50) NOT NULL AUTO_INCREMENT,
  `firstname` varchar(250) NOT NULL,
  `lastname` varchar(250) NOT NULL,
  `username` text NOT NULL,
  `password` text NOT NULL,
  `avatar` text DEFAULT NULL,
  `last_login` datetime DEFAULT NULL,
  `type` tinyint(1) NOT NULL DEFAULT 0,
  `mechanic_id` int(30) DEFAULT NULL,
  `date_added` datetime NOT NULL DEFAULT current_timestamp(),
  `date_updated` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `users` VALUES ('1', 'Vikram', 'Jain', 'admin', 'deaa2c28daa61222d25e7459b41eab5b', 'uploads/avatars/vik.png?v=1649834664', '', '1', '1', '2021-01-20 14:02:37', '2025-12-22 00:32:56');
INSERT INTO `users` VALUES ('3', 'Hemant', 'Mehra', 'hemant', '17563740df9a804bc5e3b31c5cb58984', 'uploads/avatars/3.png?v=1650527149', '', '2', '2', '2022-04-21 15:45:49', '2025-12-22 00:33:06');
INSERT INTO `users` VALUES ('4', 'Vikram', 'Jain', 'vikram', 'deaa2c28daa61222d25e7459b41eab5b', 'uploads/avatars/4.jpg', '', '1', '1', '2025-10-19 22:56:35', '2025-12-22 00:33:11');
INSERT INTO `users` VALUES ('5', 'preeti', 'jain', 'preeti', '48d9d2bbfdb0d128464d3d7ecfa626b4', 'uploads/avatars/5.png', '', '2', '3', '2025-10-20 00:19:18', '2025-12-22 00:33:16');
INSERT INTO `users` VALUES ('9', 'test', 'test', 'test', '098f6bcd4621d373cade4e832627b4f6', 'uploads/avatars/9.png', '', '2', '3', '2025-12-24 21:31:30', '2025-12-24 21:31:30');
INSERT INTO `users` VALUES ('11', 'Vikram', 'Jain', 'vikramj01', 'deaa2c28daa61222d25e7459b41eab5b', 'uploads/avatars/11.png', '', '2', '1', '2026-02-02 11:48:21', '2026-02-02 11:48:21');

