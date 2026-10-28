(function(){'use strict';
 var sidebar=document.getElementById('app-sidebar');
 var collapse=document.getElementById('sidebar-collapse');
 var expand=document.getElementById('sidebar-expand');
 var mobile=document.getElementById('mobile-menu');
 if(sidebar&&collapse) collapse.addEventListener('click',function(){ if(window.matchMedia('(max-width:800px)').matches){sidebar.classList.remove('mobile-open');}else{sidebar.classList.toggle('is-collapsed');try{localStorage.setItem('algoritm-sidebar-collapsed',sidebar.classList.contains('is-collapsed')?'1':'0')}catch(e){}} });
 if(sidebar&&expand) expand.addEventListener('click',function(){sidebar.classList.toggle('is-collapsed');try{localStorage.setItem('algoritm-sidebar-collapsed',sidebar.classList.contains('is-collapsed')?'1':'0')}catch(e){}});
 if(sidebar&&mobile) mobile.addEventListener('click',function(){sidebar.classList.toggle('mobile-open')});
 if(sidebar){try{if(localStorage.getItem('algoritm-sidebar-collapsed')==='1'&&!window.matchMedia('(max-width:800px)').matches)sidebar.classList.add('is-collapsed')}catch(e){}}
 document.addEventListener('click',function(e){if(sidebar&&window.matchMedia('(max-width:800px)').matches&&sidebar.classList.contains('mobile-open')&&!sidebar.contains(e.target)&&!(mobile&&mobile.contains(e.target)))sidebar.classList.remove('mobile-open')});
 var search=document.getElementById('quick-search');if(search)search.addEventListener('input',function(){var q=this.value.toLocaleLowerCase();document.querySelectorAll('.searchable-item').forEach(function(el){el.style.display=(!q||el.textContent.toLocaleLowerCase().indexOf(q)!==-1)?'':'none'});if(q){var courses=document.getElementById('kurslar');if(courses)courses.scrollIntoView({behavior:'smooth',block:'start'})}});
 if('IntersectionObserver' in window){var io=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){entry.target.classList.add('is-visible');io.unobserve(entry.target);}});},{threshold:.08});document.querySelectorAll('.widget-panel,.stat-v10,.course-v10,.registration-v10').forEach(function(el){el.classList.add('reveal-v10');io.observe(el);});}
})();
