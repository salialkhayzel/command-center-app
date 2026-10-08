IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.BillingDelayReasons') AND type = N'U')
BEGIN
  CREATE TABLE dbo.BillingDelayReasons (
    PK_BillingDelayReason INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    FK_psPatRegisters INT NOT NULL,
    Reason NVARCHAR(500) NOT NULL,
    CreatedBy NVARCHAR(50) NULL,
    DateCreated DATETIME NOT NULL DEFAULT GETDATE()
  );
  CREATE UNIQUE INDEX UX_BillingDelayReasons_Registry ON dbo.BillingDelayReasons (FK_psPatRegisters);
END
