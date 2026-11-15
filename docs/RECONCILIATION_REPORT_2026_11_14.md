# Venture Foods — Odoo 17 POS Revenue Reconciliation Report (`2026-11-14`)

- **Audit Window:** `2026-10-16` through `2026-11-14` (30 Calendar Days, Inclusive, `Asia/Kuwait` `UTC+3`)
- **ERP Source of Truth:** Odoo 17 `pos.order` (`state IN ('paid', 'done', 'invoiced')`, Net of Tax: `amount_total - amount_tax`) joined via `pos.session.config_id`
- **Computed Allocation Variance:** `0.000 KWD` across Exclusion Bridge (`158,168.000 - 21,590.000 = 136,578.000 KWD`), 7-Branch Allocation Bridge (`129,587.000 + 6,991.000 = 136,578.000 KWD`), and Non-Branch Bridge (`6,991.000 + 21,590.000 = 28,581.000 KWD`)

---

## 1. Executive Reconciliation Bridge (`158,168.000 KWD` -> `136,578.000 KWD`)

| Ledger Stage | Formula / Scope | Orders | Net Sales (`KWD`) |
| --- | --- | ---: | ---: |
| **1. Gross Pre-Exclusion Raw Odoo POS Total** | All 35 `pos.config` registers (`grossPreExclusionKwd`) | `34,982` | **`158,168.000`** |
| **2. Less: Excluded Decommissioned & Non-Operating Entities** | Decommissioned Dispatch & Warehouse Unit (`pos.config #24`, `#36`) + Non-Operating POS Category (`#150`) (`excludedEntitiesKwd`) | `-3,099` | **`-21,590.000`** |
| **3. Active Company Net POS Sales** | `158,168.000 - 21,590.000` (`companyTotals.netSalesKwd`) | **`31,883`** | **`136,578.000`** |
| └─ **3A. 7 Active Mapped Branches** | 18 mapped `pos.config` terminals (`sum(branches[].netSalesKwd)`) | `25,759` | **`129,587.000`** |
| └─ **3B. Unclassified / Unmapped POS Terminals** | 15 exhibition/school/unassigned terminals (`غير مصنّف — أجهزة غير مربوطة`) | `6,124` | **`6,991.000`** |
| **Computed Variance** | `(158,168 - 21,590) - 136,578` & `(129,587 + 6,991) - 136,578` | **`0`** | **`0.000`** |

### Complete Reconciliation of Non-Branch POS Bridge (`28,581.000 KWD = 6,991.000 + 21,590.000`)
Subtracting the **7 Active Mapped Branches** (`129,587.000 KWD`) from the **Gross Pre-Exclusion Raw Odoo POS Total** (`158,168.000 KWD`) yields **`28,581.000 KWD`**, which reconciles completely into two verified buckets:

| Component of `28,581.000 KWD` Non-Branch Bridge | Governance Destination | Net Sales (`KWD`) |
| --- | --- | ---: |
| **A. Unclassified Active Terminals (`#26–#29`, `#41–#42`)** | Active Exhibition Booths & School Canteens (`غير مصنّف — أجهزة غير مربوطة` / `unmappedTerminalsNetKwd`) | **`6,991.000`** |
| **B. Excluded Decommissioned Units (`#24`, `#36`, `cat#150`)** | Excluded via Governance (`excludedEntitiesKwd`) | **`21,590.000`** |
| **Total Non-Branch Bridge (`A + B`)** | `6,991.000 + 21,590.000 === 28,581.000 === 158,168.000 - 129,587.000` | **`28,581.000`** |

---

## 2. Excluded Entities Breakdown (`21,590.000 KWD`)

| Excluded Entity | Odoo Identifier(s) | Governance Reason | Orders | Excluded Net (`KWD`) |
| --- | --- | --- | ---: | ---: |
| **Decommissioned Dispatch & Warehouse Unit** | `pos.config #24` & `pos.config #36` *(inactive)* | Decommissioned warehouse & closed delivery dispatch unit outside the 7 active branches | `3,099` | **`21,590.000`** |
| **Non-Operating POS Category** | `pos.category #150` (subcategories `#151–#157`) | Non-operating / excluded category outside the 6 approved Venture Foods brands | `0` | **`0.000`** |
| **Total Excluded** | — | — | **`3,099`** | **`21,590.000`** |

---

## 3. Active 7-Branch Rollup (`129,587.000 KWD`)

| Rank | `branch_id` | Branch Name (EN / AR) | Mapped `terminal_id`s | Orders | Net Sales (`KWD`) | Share of Active (`136,578 KWD`) |
| :---: | --- | --- | --- | ---: | ---: | ---: |
| 1 | `360-mall` | 360 Mall / مول 360 | `17, 18` | `4,420` | **`24,786.000`** | `18.1%` |
| 2 | `promenade` | Promenade / بروميناد | `8, 9, 10, 11, 16` | `4,561` | **`24,092.061`** | `17.6%` |
| 3 | `ardiya` | Ardiya / العارضية | `3, 23, 35` | `3,102` | **`20,349.846`** | `14.9%` |
| 4 | `assima` | Assima / العاصمة | `14, 15` | `3,342` | **`17,758.237`** | `13.0%` |
| 5 | `salmiya` | Salmiya / السالمية | `19, 20` | `2,470` | **`17,150.088`** | `12.6%` |
| 6 | `al-kout` | Al-Kout / الكوت | `21, 22, 43` | `4,732` | **`14,615.158`** | `10.7%` |
| 7 | `avenues` | The Avenues / الأفنيوز | `34` | `3,132` | **`10,835.610`** | `7.9%` |
| — | **Subtotal (7 Branches)** | **Mapped Operating Branches** | **18 Terminals** | **`25,759`** | **`129,587.000`** | **`94.9%`** |
| — | `unmapped` | Unclassified / غير مصنّف — أجهزة غير مربوطة | **15 Terminals** | **`6,124`** | **`6,991.000`** | **`5.1%`** |
| — | **Active Company Total** | **All Active POS Operations** | **33 Active Terminals** | **`31,883`** | **`136,578.000`** | **`100.0%`** |

---

## 4. Complete `terminal_id -> branch_id` Mapping Table (All 35 Odoo `pos.config` Registers)

| `terminal_id` | Odoo `pos.config` Identifier | Status | Mapped `branch_id` | Branch / Bucket Label | Orders | Net Sales (`KWD`) |
| ---: | --- | --- | --- | --- | ---: | ---: |
| `17` | `China Garden (360)` | Mapped | `360-mall` | 360 Mall (`مول 360`) | `2,620` | `11,802.158` |
| `18` | `Delivery (360)` | Mapped | `360-mall` | 360 Mall (`مول 360`) | `1,800` | `12,983.842` |
| `8` | `China Garden (Promenade)` | Mapped | `promenade` | Promenade (`بروميناد`) | `876` | `3,676.399` |
| `9` | `Farm Brown (Promenade)` | Mapped | `promenade` | Promenade (`بروميناد`) | `764` | `2,223.530` |
| `10` | `Tahina (promenade)` | Mapped | `promenade` | Promenade (`بروميناد`) | `483` | `1,059.200` |
| `11` | `Delivery (Promenade)` | Mapped | `promenade` | Promenade (`بروميناد`) | `2,438` | `17,132.932` |
| `16` | `E-Mall (promenade)` *(inactive)* | Mapped | `promenade` | Promenade (`بروميناد`) | `0` | `0.000` |
| `23` | `Delivery (Ardiya)` | Mapped | `ardiya` | Ardiya (`العارضية`) | `3,102` | `20,349.846` |
| `3` | `Call Center` | Mapped | `ardiya` | Ardiya (`العارضية`) | `0` | `0.000` |
| `35` | `Delivery (Ardiya Temp)` *(inactive)* | Mapped | `ardiya` | Ardiya (`العارضية`) | `0` | `0.000` |
| `14` | `China Garden (Assima Mall)` | Mapped | `assima` | Assima (`العاصمة`) | `2,656` | `12,541.854` |
| `15` | `Delivery (Assima Mall)` | Mapped | `assima` | Assima (`العاصمة`) | `686` | `5,216.383` |
| `19` | `China Garden (Salmiya)` | Mapped | `salmiya` | Salmiya (`السالمية`) | `83` | `334.300` |
| `20` | `Delivery (Salmyia)` | Mapped | `salmiya` | Salmiya (`السالمية`) | `2,387` | `16,815.788` |
| `21` | `China Garden (KOUT)` | Mapped | `al-kout` | Al-Kout (`الكوت`) | `1,814` | `7,756.327` |
| `22` | `Delivery (Kout)` | Mapped | `al-kout` | Al-Kout (`الكوت`) | `1,085` | `6,305.181` |
| `43` | `FAS Fahaheel` | Mapped | `al-kout` | Al-Kout (`الكوت`) | `1,833` | `553.650` |
| `34` | `China Garden(Avenues)` | Mapped | `avenues` | The Avenues (`الأفنيوز`) | `3,132` | `10,835.610` |
| `26` | `POS EXEBITION 1` | Unmapped | `null` | `غير مصنّف — أجهزة غير مربوطة` | `1,391` | `3,114.750` |
| `27` | `POS EXEBITION 2` | Unmapped | `null` | `غير مصنّف — أجهزة غير مربوطة` | `294` | `1,158.700` |
| `28` | `POS EXEBITION 3` | Unmapped | `null` | `غير مصنّف — أجهزة غير مربوطة` | `268` | `1,131.750` |
| `42` | `FAIPS Ahmadi` | Unmapped | `null` | `غير مصنّف — أجهزة غير مربوطة` | `1,911` | `690.950` |
| `41` | `NPIS Hawally` | Unmapped | `null` | `غير مصنّف — أجهزة غير مربوطة` | `2,159` | `623.500` |
| `29` | `POS EXEBITION 4` | Unmapped | `null` | `غير مصنّف — أجهزة غير مربوطة` | `101` | `271.350` |
| `25` | `Delivery (Jahra)` | Unmapped | `null` | `غير مصنّف — أجهزة غير مربوطة` | `0` | `0.000` |
| `30` | `POS EXEBITION 5` | Unmapped | `null` | `غير مصنّف — أجهزة غير مربوطة` | `0` | `0.000` |
| `31` | `POS EXEBITION 6` | Unmapped | `null` | `غير مصنّف — أجهزة غير مربوطة` | `0` | `0.000` |
| `32` | `POS EXEBITION 7` | Unmapped | `null` | `غير مصنّف — أجهزة غير مربوطة` | `0` | `0.000` |
| `33` | `POS EXEBITION 8` | Unmapped | `null` | `غير مصنّف — أجهزة غير مربوطة` | `0` | `0.000` |
| `37` | `POS EXEBITION 9 (EXB POS 9)` | Unmapped | `null` | `غير مصنّف — أجهزة غير مربوطة` | `0` | `0.000` |
| `38` | `POS EXEBITION 10 (EXB POS 10)` | Unmapped | `null` | `غير مصنّف — أجهزة غير مربوطة` | `0` | `0.000` |
| `39` | `Tasty Snacks(Jahra)` | Unmapped | `null` | `غير مصنّف — أجهزة غير مربوطة` | `0` | `0.000` |
| `40` | `NPIS Hawally (Inactive)` | Unmapped | `null` | `غير مصنّف — أجهزة غير مربوطة` | `0` | `0.000` |
| `24` | `Decommissioned Dispatch Unit #24` | **Excluded** | `EXCLUDED` | Decommissioned Non-Operating Unit | `3,099` | `21,590.000` |
| `36` | `Decommissioned Dispatch Unit #36` *(inactive)* | **Excluded** | `EXCLUDED` | Decommissioned Non-Operating Unit | `0` | `0.000` |
| `cat#150` | `Non-Operating POS Category #150` | **Excluded** | `EXCLUDED` | Excluded Non-Operating Category | `0` | `0.000` |
| **TOTAL** | **Gross Pre-Exclusion (`35` Registers)** | — | — | — | **`34,982`** | **`158,168.000`** |
| **ACTIVE** | **Active Company Ledger (`33` Registers)** | — | — | **`129,587.000 + 6,991.000`** | **`31,883`** | **`136,578.000`** |
