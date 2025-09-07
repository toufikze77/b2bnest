-- Allow owners to insert/update/delete where applicable
drop policy if exists "payroll_employees_owner" on payroll_employees;
create policy "payroll_employees_owner" on payroll_employees
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "payroll_runs_owner" on payroll_runs;
create policy "payroll_runs_owner" on payroll_runs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "payroll_items_owner" on payroll_run_items;
create policy "payroll_items_owner" on payroll_run_items
  for all
  using (
    exists(select 1 from payroll_runs r where r.id = run_id and r.user_id = auth.uid())
  )
  with check (
    exists(select 1 from payroll_runs r where r.id = run_id and r.user_id = auth.uid())
  );

drop policy if exists "payroll_submissions_owner" on payroll_submissions;
create policy "payroll_submissions_owner" on payroll_submissions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

