-- Adds the per-case registration reason used to prioritize official forms.
-- Existing cases remain unchanged until an office member chooses a reason.
alter table public.office_cases
 add column if not exists case_kind text;

alter table public.office_cases
 add column if not exists registration_reason text;

alter table public.office_cases
 drop constraint if exists office_cases_case_kind_check;

alter table public.office_cases
 add constraint office_cases_case_kind_check
 check (case_kind is null or case_kind in ('買賣','贈與','繼承','抵押權設定','其他'));

alter table public.office_cases
 drop constraint if exists office_cases_registration_reason_check;

alter table public.office_cases
 add constraint office_cases_registration_reason_check
 check (registration_reason is null or registration_reason in (
  '第一次登記','買賣','贈與','繼承','分割繼承','拍賣','共有物分割','設定','法定','清償',
  '拋棄','混同','判決塗銷','權利價值變更','權利內容等變更','分割','合併','地目變更'
 ));

comment on column public.office_cases.registration_reason is
 'Optional registration cause selected from the land-registration application list; used to sort relevant official forms first.';
comment on column public.office_cases.case_kind is
 'Optional high-level case category, distinct from the existing case_type field that tracks how the case entered the Office system.';

notify pgrst, 'reload schema';
