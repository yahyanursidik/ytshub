# Content Model & Governance — YTS Hub

## 1. Core Entities
- Organization
- Unit
- Division
- Program
- Service
- Event
- FAQ
- Application
- Website
- Contact
- Document
- Tag
- Audience

## 2. Common Fields
Setiap entity publik minimal:
```text
id
code
slug
title
summary
description
status
visibility
owner_unit_id
published_at
updated_at
reviewed_at
review_due_at
seo_title
seo_description
```

## 3. Unit
```text
name
short_name
summary
about
logo_reference
website_url
contact_id
programs[]
services[]
faqs[]
```

## 4. Program
```text
name
summary
unit_id
category
audiences[]
status
start_date
end_date
schedule_summary
location_summary
cta_label
cta_url
related_services[]
related_faqs[]
```

## 5. Service
```text
name
summary
unit_id
audiences[]
requirements
process_steps
fee_information
cta_label
cta_url
service_channel
related_faqs[]
```

## 6. Event
```text
name
organizer_unit_id
summary
start_at
end_at
format
location
map_url
speaker_summary
registration_url
status
related_program_id
```

## 7. FAQ
```text
question
answer
category_id
owner_unit_id
audiences[]
keywords[]
related_programs[]
related_services[]
helpfulness_score
```

## 8. Application/Website Registry
Public fields:
```text
name
summary
owner_unit_id
url
type
status
cta_label
```

Internal-only optional:
```text
technical_owner
repository_reference
hosting_provider
database_provider
integration_notes
criticality
```

Jangan pernah simpan credentials/secrets di registry.

## 9. Workflow
```text
Draft
→ In Review
→ Approved
→ Published
→ Needs Review
→ Archived
```

## 10. Ownership
Setiap published content wajib punya:
- owner unit;
- responsible editor;
- approver;
- last review;
- next review.

## 11. Review Cadence
Default:
- Event: berdasarkan lifecycle event.
- Service: 90–180 hari.
- Program aktif: 30–90 hari.
- FAQ: 90–180 hari.
- Unit profile: 180 hari.
- App/website link: health-check otomatis + review metadata periodik.

## 12. Content Versioning
Simpan:
- version number;
- editor;
- timestamp;
- change summary;
- previous state atau diff.

## 13. Visibility
```text
public
internal
restricted
```

Server-side authorization harus menjadi sumber kebenaran. Jangan hanya hide komponen di frontend.
