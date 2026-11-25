"""Imported by the older test suites: they type into the full-sheet answer boxes, so every page they open
starts in the Full sheet layout (via the ?layout=sheet link option). test_flow.py covers the one-at-a-time layout."""
import worksheet_mode  # noqa: F401  (fresh pages open in Worksheet mode, not on the Path)
from playwright.sync_api._generated import Page
_goto=Page.goto
def _sheet_goto(self,url,*a,**k):
    if 'index.html' in url or url.rstrip('/').endswith(('subnet-sprint','127.0.0.1')) or url.endswith('/'):
        url=url+('&' if '?' in url else '?')+'layout=sheet'
    return _goto(self,url,*a,**k)
Page.goto=_sheet_goto
_reload=Page.reload
def _sheet_reload(self,*a,**k):
    # a test may have cleared storage; keep the Full sheet layout across reloads
    try: self.evaluate("localStorage.setItem('ss_layout',JSON.stringify('sheet'))")
    except Exception: pass
    return _reload(self,*a,**k)
Page.reload=_sheet_reload
