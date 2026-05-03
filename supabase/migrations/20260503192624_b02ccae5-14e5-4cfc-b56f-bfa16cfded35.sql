
CREATE POLICY "deny all chapters" ON public.acsm_chapters
  FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "deny all sections" ON public.acsm_sections
  FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);
