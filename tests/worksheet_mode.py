"""Imported by the suites written before the learning path: a fresh visit now opens on the Path tab, so every page
these suites open starts in Worksheet mode instead, as if the student had picked the Worksheet tab before.
test_path.py covers the path."""
from playwright.sync_api._generated import Browser, BrowserContext
# a global, not a localStorage write: writing storage while a page reloads races with the old page's writes
INIT="window.SS_DEFAULT_MODE='worksheet'"
def _wrap(cls):
    orig=cls.new_page
    def new_page(self,*a,**k):
        pg=orig(self,*a,**k); pg.add_init_script(INIT); return pg
    cls.new_page=new_page
_bctx=Browser.new_context
def new_context(self,*a,**k):
    c=_bctx(self,*a,**k); c.add_init_script(INIT); return c
Browser.new_context=new_context
_wrap(Browser)
