# GECKO IMS — SCT Proposal Bundle

Two documents prepared for **Siam Container Terminal & Transport (SCT)**, Bang Bo:

| File | Pages | Audience | Purpose |
|---|---:|---|---|
| `Gecko-IMS-SCT-Functional-Scope.md` | ~5 | Commercial / Operations owner | Module-by-module features (TOS + Trucking + EDI + portal + driver app), brief SaaS overview, cost ranges |
| `Gecko-IMS-SCT-HLD.md` | ~8 | CIO / IT / Architect | Simplified HLD — Azure topology, cross-cutting services, data, security, tenancy & cost model, DevOps |
| `Gecko-IMS-Architecture.mmd` | — | Designer | Mermaid source for the architecture diagram (renders on mermaid.live or drawio) |

Both documents are SCT-branded, Azure-targeted, and reflect actual implementation status:
- TOS, Trucking, EDI front-ends: **demo-ready**
- Driver Mobile App (Flutter): **production-ready** (`D:\SHARMA\PROJECT\gecko\driver_trucking_gecko`)
- AI add-ons (Auto-Gate, VRP dispatch, Text-to-SQL): **planned for Phase 5**

---

## Generate the `.docx` files

### One-line Pandoc command (per file)

```powershell
pandoc Gecko-IMS-SCT-Functional-Scope.md -o Gecko-IMS-SCT-Functional-Scope.docx --toc --toc-depth=2
pandoc Gecko-IMS-SCT-HLD.md              -o Gecko-IMS-SCT-HLD.docx              --toc --toc-depth=2
```

For brand styling, create a `reference.docx` once with GECKO fonts/colors, then add `--reference-doc=reference.docx` to each command.

### Alternative — VSCode extension

Install "Markdown PDF" or similar, right-click each `.md` → Export as DOCX.

---

## Render the architecture diagram

The Mermaid source is `Gecko-IMS-Architecture.mmd`.

1. **Mermaid Live** — open https://mermaid.live, paste the file, export PNG/SVG
2. **diagrams.net (drawio, editable)** — open https://app.diagrams.net → Arrange → Insert → Advanced → Mermaid; paste, edit, export
3. Insert the exported image into the HLD `.docx` after Section 1 (Solution Topology)

---

## Pre-send checklist

- [ ] Both `.docx` files generated and opened in Word — formatting clean
- [ ] Cover-page tables show "Siam Container Terminal & Transport" (not placeholder)
- [ ] Architecture diagram inserted into HLD after Section 1
- [ ] SCT logo added to header next to GECKO logo
- [ ] Footer "Confidential · GECKO · 2026" with page numbers
- [ ] Cost figures confirmed against latest Azure SEA pricing
- [ ] PDF export from Word — "Document properties → Subject" set
- [ ] Files renamed to include date: `Gecko-IMS-SCT-<Doc>-<YYYY-MM-DD>.{docx,pdf}`
