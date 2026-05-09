/* ==========================================================================
   Gecko Master DB — CREATE DATABASE script (per tenant)
   --------------------------------------------------------------------------
   Run ONCE per tenant to create their Master DB. After it runs, migrations
   in db/master/migrations/ can be applied inside the new DB.

   For Phase 1 dev, leave the SQLCMD variable as 'dev'. For tenant onboarding
   later, change :setvar TENANT_SLUG to the tenant's slug (e.g. 'sct',
   'lcb_icd', 'westports_kl').

   Defaults are tuned for SQL Server 2022/2025, dev / pilot scale.
   See PRODUCTION TUNING comments below for the changes you'll want at scale.
   ========================================================================== */

:setvar TENANT_SLUG "dev"
:setvar DB_NAME     "gecko_master_$(TENANT_SLUG)"

USE master;
GO

PRINT N'Creating database $(DB_NAME)...';

-- Drop if exists (dev-friendly; remove this block for production)
IF DB_ID(N'$(DB_NAME)') IS NOT NULL
BEGIN
  PRINT N'  Database $(DB_NAME) exists — dropping for clean re-create.';
  ALTER DATABASE [$(DB_NAME)] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
  DROP DATABASE [$(DB_NAME)];
END
GO

CREATE DATABASE [$(DB_NAME)]
COLLATE Latin1_General_100_CI_AS_SC_UTF8;     -- UTF-8 native, handles all SEA scripts
                                              -- (Thai, Vietnamese, Chinese, Bahasa) +
                                              -- supplementary chars (emoji etc.)
GO

ALTER DATABASE [$(DB_NAME)] SET COMPATIBILITY_LEVEL = 160;   -- SQL Server 2022+ behaviour
GO

ALTER DATABASE [$(DB_NAME)] SET RECOVERY SIMPLE;
-- ^ Dev only. PRODUCTION TUNING: change to FULL for prod tenant DBs to enable
--   point-in-time restore. Then schedule LOG backups every 15min.
GO

ALTER DATABASE [$(DB_NAME)] SET READ_COMMITTED_SNAPSHOT ON;
-- ^ Critical for high concurrency. Readers don't block writers, writers don't
--   block readers. Standard for any modern OLTP DB. Worth the row-versioning cost.
GO

ALTER DATABASE [$(DB_NAME)] SET ALLOW_SNAPSHOT_ISOLATION ON;
GO

ALTER DATABASE [$(DB_NAME)] SET QUERY_STORE = ON
  (OPERATION_MODE = READ_WRITE,
   CLEANUP_POLICY = (STALE_QUERY_THRESHOLD_DAYS = 30),
   DATA_FLUSH_INTERVAL_SECONDS = 900,
   QUERY_CAPTURE_MODE = AUTO,
   MAX_STORAGE_SIZE_MB = 1024);
-- ^ Free perf telemetry — captures query plans + execution stats. Essential for
--   identifying slow queries in any production DB. 1GB cap is generous for dev.
GO

ALTER DATABASE [$(DB_NAME)] SET AUTO_CREATE_STATISTICS ON;
ALTER DATABASE [$(DB_NAME)] SET AUTO_UPDATE_STATISTICS ON;
ALTER DATABASE [$(DB_NAME)] SET AUTO_UPDATE_STATISTICS_ASYNC ON;
GO

-- Enable temporal tables prerequisites
ALTER DATABASE [$(DB_NAME)] SET DELAYED_DURABILITY = DISABLED;
GO

-- PRODUCTION TUNING (commented — apply when sizing matters):
-- ALTER DATABASE [$(DB_NAME)] MODIFY FILE
--   (NAME = N'$(DB_NAME)',     SIZE = 1024MB, FILEGROWTH = 256MB, MAXSIZE = UNLIMITED);
-- ALTER DATABASE [$(DB_NAME)] MODIFY FILE
--   (NAME = N'$(DB_NAME)_log', SIZE = 256MB,  FILEGROWTH = 64MB,  MAXSIZE = UNLIMITED);
-- ALTER DATABASE [$(DB_NAME)] MODIFY FILEGROUP [PRIMARY] DEFAULT;
-- For Azure SQL: tier this DB (S2 starter, scale up under DTU pressure)
-- For on-prem: place data file on fast SSD, log file on separate volume
GO

PRINT N'Database $(DB_NAME) created. Settings:';
PRINT N'  Collation: Latin1_General_100_CI_AS_SC_UTF8 (SEA-friendly UTF-8)';
PRINT N'  Compatibility level: 160 (SQL Server 2022+)';
PRINT N'  Recovery model: SIMPLE (dev) — change to FULL for production';
PRINT N'  RCSI + Snapshot isolation: enabled';
PRINT N'  Query Store: enabled (1GB)';
GO

USE [$(DB_NAME)];
GO

PRINT N'';
PRINT N'Next step: apply schema migrations in order:';
PRINT N'  db/master/migrations/0001_initial_schema.sql';
PRINT N'  db/master/migrations/0002_temporal_and_rls.sql';
PRINT N'  db/master/migrations/0003_seed_lookups.sql';
GO
