document.addEventListener('DOMContentLoaded',()=>{
 const nodes=document.querySelectorAll('.hero-copy,.hero-art,.section-heading,.course-card,.benefits>div,.registration-copy,.registration-form,.detail-panel');
 nodes.forEach(n=>n.classList.add('reveal'));
 if('IntersectionObserver' in window){const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target)}}),{threshold:.12});nodes.forEach(n=>io.observe(n));}else nodes.forEach(n=>n.classList.add('visible'));
 const search=document.querySelector('[data-student-search]');if(search){search.addEventListener('input',()=>{const q=search.value.toLowerCase();document.querySelectorAll('[data-student-row]').forEach(r=>r.hidden=!r.textContent.toLowerCase().includes(q));});}
});
