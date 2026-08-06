/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19  Distrib 10.11.14-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: 127.0.0.1    Database: vivera_crm
-- ------------------------------------------------------
-- Server version	10.11.14-MariaDB-0ubuntu0.24.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `labels`
--

DROP TABLE IF EXISTS `labels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `labels` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `color` varchar(30) NOT NULL DEFAULT 'gray',
  `category` enum('objecao','origem','etapa_temporal','outro') NOT NULL DEFAULT 'outro',
  `pipedrive_id` int(11) DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=95 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `labels`
--

LOCK TABLES `labels` WRITE;
/*!40000 ALTER TABLE `labels` DISABLE KEYS */;
INSERT INTO `labels` VALUES
(1,'Lead MKT','gray','outro',49,1),
(2,'HOF','purple','outro',51,1),
(3,'Implantes','orange','outro',50,1),
(4,'Nunca Respondeu','red','outro',94,1),
(5,'Não Responde','blue','outro',80,1),
(6,'Passou por Dia Seguinte','orange','outro',100,1),
(7,'Passou por D + 1','orange','outro',105,1),
(8,'Passou por D + 2','orange','outro',101,1),
(9,'Passou por D + 3','orange','outro',102,1),
(10,'Passou por D + 4','orange','outro',103,1),
(11,'Passou por D + 5','orange','outro',104,1),
(12,'já é paciente','gray','outro',64,1),
(13,'Dra Kissya','pink','outro',65,1),
(14,'odontologia','gray','outro',66,1),
(29,'Objeção financeira','green','objecao',107,1),
(30,'Follow-up','pink','outro',99,1),
(31,'Parou de responder após o valor da consulta','pink','outro',109,1),
(32,'Reagendamento','green','outro',48,1),
(33,'desqualificada','purple','outro',112,1),
(34,'Google','dark-gray','outro',62,1),
(35,'Fechou na avaliação','green','outro',61,1),
(36,'Dra Jéssica','yellow','outro',67,1),
(37,'Qualificado','gray','outro',74,1),
(38,'Não qualificado','dark-gray','outro',106,1),
(39,'indicação Lead','pink','outro',63,1),
(40,'LENTES','red','outro',81,1),
(41,'Indicação paciente','green','outro',69,1),
(42,'Indicação dentro da clinica','dark-gray','outro',78,1),
(43,'ORGANICO','pink','outro',79,1),
(44,'Objeção de distância(muito longe)','brown','objecao',108,1),
(45,'Não tem interesse no momento','brown','objecao',115,1),
(46,'consulta','brown','outro',110,1),
(47,'DR. DIEGO','red','outro',98,1),
(48,'Indicação Sara','blue','outro',121,1),
(49,'embaixadores','dark-gray','outro',113,1),
(68,'Fechou Follow-Up','green','outro',97,1),
(82,'Lista_Resgate','dark-gray','outro',111,1),
(87,'CHECKED','green','outro',NULL,1),
(88,'Paciente A','#ca8a04','outro',NULL,1),
(89,'Paciente B','#3b82f6','outro',NULL,1),
(90,'Paciente C','#eab308','outro',NULL,1),
(91,'Paciente P','#dc2626','outro',NULL,1),
(92,'NUNCA AGENDAR','#dc2626','outro',NULL,1),
(93,'Medo','gray','objecao',NULL,1),
(94,'Nao confia no profissional','gray','objecao',NULL,1);
/*!40000 ALTER TABLE `labels` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `patient_labels`
--

DROP TABLE IF EXISTS `patient_labels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `patient_labels` (
  `patient_id` int(11) NOT NULL,
  `label_id` int(11) NOT NULL,
  PRIMARY KEY (`patient_id`,`label_id`),
  KEY `label_id` (`label_id`),
  CONSTRAINT `patient_labels_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`),
  CONSTRAINT `patient_labels_ibfk_2` FOREIGN KEY (`label_id`) REFERENCES `labels` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `patient_labels`
--

LOCK TABLES `patient_labels` WRITE;
/*!40000 ALTER TABLE `patient_labels` DISABLE KEYS */;
INSERT INTO `patient_labels` VALUES
(2871,91),
(2871,92),
(3133,91),
(3133,92),
(3158,91),
(3158,92),
(3160,91),
(3160,92),
(3179,91),
(3179,92),
(3198,91),
(3198,92),
(3295,91),
(3295,92),
(4134,89),
(4146,88);
/*!40000 ALTER TABLE `patient_labels` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-30 22:47:12
