(function(){'use strict';
window.MICROSOURCES={
netrusov:{title:'Нетрусов А. И., Котова И. Б. Микробиология: теория и практика. Часть 1. Юрайт, 2018.',detail:'Основной русскоязычный источник: строение, рост, питание, энергетика и метаболическое разнообразие. По доступному тексту сверены выбранные фрагменты о структуре, переносчиках, центральных путях и анаэробном обмене; изложение написано заново.'},
brock:{title:'Madigan et al. Brock Biology of Microorganisms. 15th ed., Global ed. Pearson, 2018.',detail:'По доступному на Диске фрагменту сверена гл. 2 (структура и функции клетки). Для расширенного чтения: гл. 3–7, 11, 14, 19–23; эти маршруты указаны по оглавлению и не означают прочтения полного издания.'},
asm:{title:'ASM Recommended Curriculum Guidelines for Undergraduate Microbiology, 2024.',url:'https://asm.org/getmedia/7bcb486c-858a-4bc9-a958-9c2c04469a0d/2024-asm-recommended-curriculum-guidelines-for-undergraduate-microbiology-fundamental-statements-and-skills.pdf?ext=.pdf',detail:'Ориентир учебных результатов и научных навыков; не сертификат соответствия или замена полному университетскому курсу.'},
giant:{title:'Volland et al. A centimeter-long bacterium with DNA contained in metabolically active, membrane-bound organelles. Science, 2022.',url:'https://pubmed.ncbi.nlm.nih.gov/35737788/',detail:'Первичное исследование Thiomargarita magnifica и компартментализации ДНК.'},
gliding:{title:'Faure et al. The mechanism of force transmission at bacterial focal adhesion complexes. Nature 539, 530–535, 2016.',url:'https://doi.org/10.1038/nature20121',detail:'Первичное исследование аппарата Agl–Glt у Myxococcus xanthus.'},
luria:{title:'Luria S. E., Delbrück M. Mutations of Bacteria from Virus Sensitivity to Virus Resistance. Genetics 28, 491–511, 1943.',url:'https://doi.org/10.1093/genetics/28.6.491',detail:'Первичный флуктуационный эксперимент; различение возникновения вариантов и отбора.'},
tolerance:{title:'Balaban et al. Definitions and guidelines for research on antibiotic persistence. Nature Reviews Microbiology 17, 441–448, 2019.',url:'https://doi.org/10.1038/s41579-019-0196-3',detail:'Согласованные определения резистентности, толерантности и персистенции.'},
biofilm:{title:'Klementiev et al. Micron Scale Spatial Measurement of the O₂ Gradient Surrounding a Bacterial Biofilm in Real Time. mBio, 2020.',url:'https://doi.org/10.1128/mBio.02536-20',detail:'Первичное исследование кислородных градиентов. Имеется erratum 2022: DOI 10.1128/mbio.00803-22; численные результаты статьи в интерактив не перенесены.'},
openstax:{title:'Parker et al. Microbiology. OpenStax, 2016.',url:'https://openstax.org/details/books/microbiology',detail:'Открытое дополнительное чтение: гл. 2–4, 8–11, 13–14. Не используется как источник для копирования текста.'}
};
window.MICROPHOTOS=[
['staph','Staphylococcus aureus','Гроздья кокков','Окраска по Граму; исходное описание ×1000','Y. Tambe','CC BY-SA 3.0','https://creativecommons.org/licenses/by-sa/3.0/','Staphylococcus_aureus_Gram.jpg','Фиолетовые кокки в неправильных скоплениях. Форма и окраска не доказывают вид.'],
['strep','Streptococcus pyogenes','Цепочки кокков','Окрашенный клинический мазок; метод см. первоисточник','CDC PHIL','Общественное достояние','','Streptococcus_pyogenes.jpg','Цепочки мелких клеток; крупные клетки хозяина нельзя считать бактериями.'],
['micro','Micrococcus luteus','Тетрады','Окраска по Граму','Alonnardi','CC BY-SA 3.0','https://creativecommons.org/licenses/by-sa/3.0/','Gram-M.l.jpg','Небольшие группы кокков; плоскости деления влияют на вид скопления.'],
['sarcina','Sarcina ventriculi','Пакеты клеток','Биоптат желудка, гематоксилин и эозин','Ed Uthman','CC BY 2.0','https://creativecommons.org/licenses/by/2.0/','Sarcina_ventriculi_in_gastric_ulcer_(48073120256).jpg','Розовый фон принадлежит ткани. Имеющаяся версия кадрирована и содержит добавленные стрелки.'],
['bacillus','Bacillus anthracis','Палочки в цепочках','Окраска по Граму','CDC PHIL','Общественное достояние','','Bacillus_anthracis_Gram.jpg','Описание автора первоисточника. По одной форме нельзя самостоятельно установить вид.'],
['vibrio','Vibrio cholerae','Изогнутые палочки','Окраска по Граму','CDC PHIL','Общественное достояние','','Vibrio_cholerae_gram_stain_CDC.jpg','Видны изогнутые клетки; тонкий жгутик этим методом обычно не выявляется.'],
['spirillum','Spirillum','Спиральные клетки','Фазовый контраст, живые клетки','Wolframm Adlassnig','Общественное достояние','','Spirillen.jpg','Контраст показывает форму без обычной окраски; одиночный кадр не измеряет скорость плавания.'],
['treponema','Treponema pallidum','Спирохеты','Тёмное поле','CDC / C. W. Hubbard','Общественное достояние','','Treponema_pallidum_cropped.png','Тонкие светлые спирали на тёмном фоне. Имеющаяся версия кадрирована.'],
['strepto','Streptomyces','Ветвящиеся нити','Окрашенный препарат; метод см. первоисточник','James kunn','CC BY 4.0','https://creativecommons.org/licenses/by/4.0/','Microscopic_id_of_actinomycetes,CDB,T.U.jpg','Ветвление напоминает гифы, но это не доказательство принадлежности к грибам.'],
['grammix','S. aureus и E. coli','Смешанный контроль','Окраска по Граму; исходное описание ×1000','Y. Tambe','CC BY-SA 3.0','https://creativecommons.org/licenses/by-sa/3.0/','Gram_stain_01.jpg','Фиолетовые кокки и розовые палочки позволяют сопоставить реакцию в одном препарате.'],
['spores','Bacillus cereus','Эндоспоры','Метод Шеффера–Фултона; исходное описание ×1000','T. Nims','CC BY-SA 4.0','https://creativecommons.org/licenses/by-sa/4.0/','Bacillus_cereus_endospore_stain.jpg','Споры сине-зелёные, вегетативные клетки розово-красные. Споруляция не увеличивает число клеток.'],
['vibrio_tem','Vibrio cholerae','Один полярный жгутик','Просвечивающая ЭМ, негативный контраст','T. Kirn, R. Taylor, L. Howard; Dartmouth EM Facility','Общественное достояние','','Vibrio_cholerae.jpg','Различим тонкий наружный жгутик. Цвет и плотность электронного изображения не являются естественной окраской клетки.']
].map(([id,organism,title,method,author,license,licenseURL,file,observation])=>({id,organism,title,method,author,license,licenseURL,source:'https://commons.wikimedia.org/wiki/File:'+file,file:id+'.jpg',observation,scale:'Отдельная калиброванная масштабная линейка для этой учебной копии не задана. Не измеряй размеры по экрану.'}));
})();

(function(){
'use strict';
const S=window.MICROSOURCES;
const os=(id,slug,title)=>{S[id]={title:'OpenStax · Microbiology · '+title,url:'https://openstax.org/books/microbiology/pages/'+slug,detail:'Открытый учебник ASM Press / OpenStax. Дополнительный проверяемый маршрут по механизму; изложение в учебнике Фагов написано самостоятельно.'};};
os('os-cell','3-3-unique-characteristics-of-prokaryotic-cells','3.3 · Прокариотическая клетка');
os('os-microscopy','2-3-instruments-of-microscopy','2.3 · Методы микроскопии');
os('os-staining','2-4-staining-microscopic-specimens','2.4 · Окраска препаратов');
os('os-energy','8-1-energy-matter-and-enzymes','8.1 · Энергия и переносчики');
os('os-carbohydrates','8-2-catabolism-of-carbohydrates','8.2 · Катаболизм углеводов');
os('os-respiration','8-3-cellular-respiration','8.3 · Дыхание');
os('os-fermentation','8-4-fermentation','8.4 · Брожение');
os('os-lipids','8-5-catabolism-of-lipids-and-proteins','8.5 · Липиды и белки');
os('os-photo','8-6-photosynthesis','8.6 · Фотосинтез');
os('os-growth','9-1-how-microbes-grow','9.1 · Рост и измерения');
os('os-oxygen','9-2-oxygen-requirements-for-microbial-growth','9.2 · Кислород');
os('os-water','9-5-other-environmental-conditions-that-affect-growth','9.5 · Осмотические и другие ограничения');
os('os-media','9-6-media-used-for-bacterial-growth','9.6 · Питательные среды');
os('os-replication','11-2-dna-replication','11.2 · Репликация');
os('os-mutations','11-5-mutations','11.5 · Мутации');
os('os-diversity','11-6-how-asexual-prokaryotes-achieve-genetic-diversity','11.6 · Горизонтальный перенос');
os('os-drugs','14-3-mechanisms-of-antibacterial-drugs','14.3 · Мишени антибактериальных веществ');
Object.assign(S,{
woese:{title:'Woese, Kandler, Wheelis. Towards a natural system of organisms. PNAS, 1990.',url:'https://doi.org/10.1073/pnas.87.12.4576',detail:'Первичная работа о трёх доменах. Современные вопросы происхождения эукариот не сводятся к исходной трёхветвевой схеме.'},
'spore-primary':{title:'Colas de la Noue et al. The molecular dynamics of bacterial spore and the role of calcium dipicolinate in core properties. Scientific Reports, 2020.',url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC7237433/',detail:'Первичное исследование свойств сердцевины спор; Ca-дипиколинат и состояние ядра споры.'},
archaellum:{title:'Streif et al. Flagellar rotation in the archaeon Halobacterium salinarum depends on ATP. J Mol Biol, 2008.',url:'https://pubmed.ncbi.nlm.nih.gov/18786541/',detail:'Экспериментальная основа различения энергетики бактериального мотора и архаэллума.'},
'anaerobe-primary':{title:'Jean, Briolat, Reysset. Oxidative stress response in Clostridium perfringens. Microbiology, 2004.',url:'https://pubmed.ncbi.nlm.nih.gov/15184551/',detail:'Первичное исследование защиты анаэроба от окислительного стресса. Нельзя выводить фенотип только из отсутствия каталазы и СОД.'},
'nitrifier-primary':{title:'Daims et al. Complete nitrification by Nitrospira bacteria. Nature, 2015.',url:'https://doi.org/10.1038/nature16461',detail:'Первичная работа о полном окислении аммиака; уточняет классическую двухорганизменную схему нитрификации.'},
'nitrogen-review':{title:'Seefeldt, Hoffman, Dean. Mechanism of Mo-dependent nitrogenase. Annu Rev Biochem, 2009.',url:'https://doi.org/10.1146/annurev.biochem.78.070907.103812',detail:'Обзор механизма Mo-нитрогеназы; электронный и ATP-бюджет. Классическое уравнение не тождественно полным затратам роста.'},
'monod-primary':{title:'Monod. The growth of bacterial cultures. Annual Review of Microbiology, 1949.',url:'https://doi.org/10.1146/annurev.mi.03.100149.002103',detail:'Классическое изложение кинетики роста; границы феноменологического описания.'},
chemotaxis:{title:'Yue et al. Enhanced bacterial chemotaxis in confined microchannels. eLife.',url:'https://elifesciences.org/articles/102686/figures#video2',detail:'Первичное исследование и Video 2: E. coli в микроканале 44 мкм, градиент аспартата; CC BY 4.0. Локальная видеокопия уже опубликована в основном курсе.'}
});
const root='media/';
const add=(id,organism,title,file,pid,author,method,observation,scale)=>window.MICROPHOTOS.push({id,organism,title,file,url:root+file,source:'https://phil.cdc.gov/Details.aspx?pid='+pid,author:'CDC PHIL · '+author,method,observation,license:'Общественное достояние',licenseURL:'https://phil.cdc.gov/FAQ.aspx',scale:scale||'Размер на экране не равен размеру объекта. Если нужна калибровка, используй масштабную линейку исходного снимка.'});
add('ecoli-sem','Escherichia coli','Клетка на пористом фильтре','mb-ecoli-sem.jpg',7138,'E. Sowers, J. Haney Carr','Сканирующая электронная микроскопия','Палочка лежит на подложке. Тёмные округлые отверстия — поры фильтра, а не детали бактерии.','В исходном кадре есть линейка 2 мкм; ориентируйся на неё, а не на размер изображения.');
add('gram-positive','Staphylococcus aureus','Грамположительные кокки','mb-gram-pos.jpg',2297,'R. Facklam','Окраска по Граму','Фиолетовые округлые клетки в скоплениях. Вид установлен автором источника.');
add('gram-negative','Escherichia coli','Грамотрицательные палочки','mb-gram-neg.jpg',24573,'K. Skogstad','Окраска по Граму','Розовые палочки. Сравни форму и реакцию с грамположительным препаратом.');
add('peritrich','Bacillus sp.','Перитрихиальное жгутикование','mb-perit.jpg',19267,'W. A. Clark','Специальная окраска жгутиков по Лейфсону','Тонкие нити стали видимы после специального контрастирования. Обычная окраска по Граму не даёт такого изображения жгутиков.');
add('treponema-em','Treponema pallidum','Спиральное тело в ЭМ','mb-trep.jpg',2392,'J. Ayers','Электронная микроскопия','Видна спиральная форма. Сам этот снимок не доказывает расположение и механизм работы периплазматических жгутиков.');
add('vibrio-sem','Vibrio cholerae O1','Изогнутая клетка в СЭМ','mb-vc-sem.jpg',7819,'J. Haney Carr','Сканирующая электронная микроскопия','Рельеф изогнутой клетки. Не путай рельеф изображения с естественной окраской.','В исходном кадре есть линейка 1 мкм.');
window.MICROPHOTOS.push({id:'anabaena',organism:'Anabaena sp.',title:'Одна цианобактерия — три метода',file:'anabaena-microscopy.webp',url:'media/anabaena-microscopy.webp',source:'https://www.frontiersin.org/journals/microbiology/articles/10.3389/fmicb.2022.939347/full#F1',author:'Agarwal, Soni, Kaur, Madan, Mishra, Pandey, Singh & Singh · 2022',method:'A: фазовый контраст; B: СЭМ; C: флуоресценция',observation:'Оригинальная многочастная иллюстрация 1772×1864. Сравни нити, клетки и обозначенные авторами гетероцисты. Флуоресцентная яркость сообщает о сигналах пигментов, а не напрямую о жизнеспособности.',license:'CC BY 4.0',licenseURL:'https://creativecommons.org/licenses/by/4.0/',scale:'Оригинальная Figure 1 сохранена целиком без изменения панелей. Калиброванная линейка не указана; не измеряй размеры по экрану.'});
})();
