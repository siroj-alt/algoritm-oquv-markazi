ALGОRITM O'QUV MARKAZI — V10 DESIGN UPDATE

What changed:
- Rebuilt the public home page in a dark, neon-red dashboard style inspired by the supplied reference image.
- Added a left expandable/collapsible sidebar, mobile slide-in menu, top search, hero artwork made with CSS, animated background particles, course cards, stats and dashboard widgets.
- Added a working dark/light theme toggle. The selected theme is saved in localStorage and persists across pages that load assets/js/theme.js.
- Fixed the participants page so it does not crash if the students.enrolled_at column is missing from an older database.
- Added a small payment shortcut to the home page. The full payment workflow remains on payment.php; the shortcut requires course selection and a receipt.

Install on Windows/XAMPP:
1. Back up your current folder and database first.
2. Extract this ZIP.
3. Copy the contents of algoritm_oquv_markazi into C:\xampp\htdocs\algoritm_oquv_markazi and replace old files.
4. Do not drop or recreate your existing database for this design update.
5. Start Apache and MySQL, then open http://localhost/algoritm_oquv_markazi/.
6. If old styles remain, hard-refresh (Ctrl+F5) or clear the browser cache.

Note: this is a functional PHP template and reference-inspired implementation, not a pixel-perfect copy of every pixel in the screenshot. Verify it in your local browser and confirm database/payment workflows before public deployment. Click/Payme live merchant processing is not included; card-transfer receipt review remains manual.
