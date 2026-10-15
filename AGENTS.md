# Project architecture rules

- Render task priorities through the shared `PriorityBadge` mapping so List, Board, mobile, calendar, and workspace views cannot drift visually.- Support ticketing: tickets/messages are written only through support_* RPCs (security definer, explicit checks); external customers live in support_customers, never organization_members, so they get no company data or seats.
