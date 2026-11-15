# Venture Foods — Odoo 17 POS Revenue Reconciliation Report (`2026-11-14`)

- **Audit Window:** `2026-10-16` through `2026-11-14` (30 Calendar Days, Inclusive, `Asia/Kuwait` `UTC+3`)
- **ERP Source of Truth:** Odoo 17 `pos.order` (`state IN ('paid', 'done', 'invoiced')`, Net of Tax: `amount_total - amount_tax`) joined via `pos.session.config_id`
- **Reconciliation Variance:** **`0.000 KWD`** across both Exclusion Bridge and Branch Allocation Bridge

---

## 1. Executive Reconciliation Bridge (`158,168.000 KWD` -> `136,578.000 KWD`)

| Ledger Stage | Formula / Scope | Orders | Net Sales (`KWD`) |
| --- | --- | ---: | ---: |
| **1. Gross Pre-Exclusion Raw Odoo POS Total** | All 35 `pos.config` registers (`grossPreExclusionKwd`) | `34,982` | **`158,168.000`** |
| **2. Less: Excluded Decommissioned & Non-Operating Entities** | Decommissioned **Qurain** (`#24`, `#36`) + Excluded Brand **Heisenberg** (`HB #150`) (`excludedEntitiesKwd`) | `-3,099` | **`-21,590.000`** |
| **3. Active Company Net POS Sales** | `158,168.000 - 21,590.000` (`companyTotals.netSalesKwd`) | **`31,883`** | **`136,578.000`** |
| └─ **3A. 7 Active Mapped Branches** | 18 mapped `pos.config` terminals (`sum(branches[].netSalesKwd)`) | `25,759` | **`129,587.000`** |
| └─ **3B. Unclassified / Unmapped POS Terminals** | 15 exhibition/school/unassigned terminals (`غير مصنّف — أجهزة غير مربوطة`) | `6,124` | **`6,991.000`** |
| **Reconciliation Gap** | `(158,168 - 21,590) - 136,578` & `(129,587 + 6,991) - 136,578` | **`0`** | **`0.000`** |

### Verified Mathematical Identities
1. **Exclusion Identity:** `grossPreExclusionKwd (158,168.000) - excludedEntitiesKwd (21,590.000) === companyTotals.netSalesKwd (136,578.000)` (`0.000 KWD` gap)
2. **Branch Allocation Identity:** `sum(7 mapped branches = 129,587.000) + unmappedTerminalsNetKwd (6,991.000) === companyTotals.netSalesKwd (136,578.000)` (`0.000 KWD` gap)

> **Historical Note on Prior Unmapped Bucket (`30,434 KWD` -> `6,991 KWD`):**
> Prior to the decommissioned branch exclusion and POS terminal audit, raw unmapped POS revenue stood at `30,434.000 KWD` (`158,168.000` gross - `127,734.000` initially mapped). Excluding decommissioned **Qurain** (`21,590.000 KWD`) and binding active branch terminals (`#19/#20` Salmiya, `#43` Al-Kout, `#34` The Avenues, etc.) reduced unmapped POS revenue to **`6,991.000 KWD`** (strictly temporary exhibition booths `#26–#29` and school canteens `#41–#42`).

---

## 2. Excluded Entities Breakdown (`21,590.000 KWD`)

| Excluded Entity | Odoo Identifier(s) | Governance Reason | Orders | Excluded Net (`KWD`) |
| --- | --- | --- | ---: | ---: |
| **Qurain (`Qurain WH` / `QRN` / `القرين`)** | `pos.config #24` (`Delivery (Qurain)`, `picking_type: Qurain: PoS Orders`) & `pos.config #36` (`Delivery (Qurain Temp)`, inactive) | Decommissioned warehouse & closed delivery dispatch unit | `3,099` | **`21,590.000`** |
| **Heisenberg (`هايزن بريج`)** | `pos.category #150` (`HB`, subcategories `#151–#157`) | Non-operating / excluded brand outside the 6 approved Venture Foods brands | `0` | **`0.000`** |
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

| `terminal_id` | Odoo `pos.config` Name | Status | Mapped `branch_id` | Branch / Bucket Label | Orders | Net Sales (`KWD`) |
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
| `24` | `Delivery (Qurain)` | **Excluded** | `EXCLUDED` | Decommissioned Qurain (`القرين`) | `3,099` | `21,590.000` |
| `36` | `Delivery (Qurain Temp)` *(inactive)* | **Excluded** | `EXCLUDED` | Decommissioned Qurain (`القرين`) | `0` | `0.000` |
| `cat#150` | `HB — Heisenberg (pos.category #150)` | **Excluded** | `EXCLUDED` | Excluded Brand (`هايزن بريج`) | `0` | `0.000` |
| **TOTAL** | **Gross Pre-Exclusion (`35` Registers)** | — | — | — | **`34,982`** | **`158,168.000`** |
| **ACTIVE** | **Active Company Ledger (`33` Registers)** | — | — | **`129,587.000 + 6,991.000`** | **`31,883`** | **`136,578.000`** |
