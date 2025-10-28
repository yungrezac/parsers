// main.js
let parsedData = [];
let resultsChartInstance = null;

// --- Прокси через Netlify Function ---
async function fetchJson(url) {
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
}

// --- Поиск по названию ---
async function fetchSearchProducts(query) {
    if (!query) throw new Error("Введите название.");
    const allProducts = [];
    let page = 1;
    const maxPages = 10;

    while (page <= maxPages) {
        const url = `https://search.wb.ru/exactmatch/ru/common/v5/search?appType=1&curr=rub&dest=-1257786&query=${encodeURIComponent(query)}&resultset=catalog&sort=popular&spp=30&page=${page}`;
        const data = await fetchJson(url);

        if (!data.data?.products?.length) break;

        data.data.products.forEach(p => {
            let stock = 0;
            p.sizes?.forEach(s => {
                s.stocks?.forEach(st => stock += st.qty || 0) || (stock += s.qty || 0);
            });

            allProducts.push({
                id: p.id,
                name: p.name,
                brand: p.brand,
                price: p.salePriceU / 100,
                rating: p.reviewRating || 0,
                reviews: p.feedbacks || 0,
                stock,
                params: {}
            });
        });

        if (allProducts.length >= (data.data.total || 0)) break;
        page++;
        await new Promise(r => setTimeout(r, 600));
    }
    return allProducts;
}

// --- Массовый парсинг ---
async function fetchMassProducts(sellerId, brandId) {
    if (!sellerId && !brandId) throw new Error("Укажите ID.");
    if (sellerId && brandId) throw new Error("Только один ID.");

    const endpoint = sellerId
        ? `https://catalog.wb.ru/sellers/v4/catalog?appType=1&curr=rub&dest=-1257786&sort=popular&spp=30&supplier=${sellerId}`
        : `https://catalog.wb.ru/brands/v2/catalog?appType=1&curr=rub&dest=-1257786&sort=popular&spp=30&brand=${brandId}`;

    const allProducts = [];
    let page = 1;
    const maxPages = 10;

    while (page <= maxPages) {
        const url = `${endpoint}&page=${page}`;
        const data = await fetchJson(url);

        if (!data.data?.products?.length) break;

        data.data.products.forEach(p => {
            let stock = 0;
            p.sizes?.forEach(s => {
                s.stocks?.forEach(st => stock += st.qty || 0) || (stock += s.qty || 0);
            });

            allProducts.push({
                id: p.id,
                name: p.name,
                brand: p.brand,
                price: p.salePriceU / 100,
                rating: p.reviewRating || p.rating || 0,
                reviews: p.feedbacks || p.feedbackCount || 0,
                stock,
                params: {}
            });
        });

        if (allProducts.length >= (data.data.total || 0)) break;
        page++;
        await new Promise(r => setTimeout(r, 600));
    }
    return allProducts;
}

// --- DOM Ready ---
document.addEventListener('DOMContentLoaded', () => {
    try { Telegram.WebApp.ready(); Telegram.WebApp.expand(); } catch(e) {}

    const tabSingle = document.getElementById('tab-single');
    const tabMass = document.getElementById('tab-mass');
    const panelSingle = document.getElementById('panel-single');
    const panelMass = document.getElementById('panel-mass');
    const parseSingleBtn = document.getElementById('parse-single-btn');
    const parseMassBtn = document.getElementById('parse-mass-btn');
    const exportBtn = document.getElementById('export-btn');
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error-msg');
    const resultsContainer = document.getElementById('results-container');
    const tableBody = document.getElementById('results-table-body');

    // Вкладки
    tabSingle.onclick = () => { tabSingle.classList.add('active'); tabMass.classList.remove('active'); panelSingle.classList.remove('hidden'); panelMass.classList.add('hidden'); };
    tabMass.onclick = () => { tabMass.classList.add('active'); tabSingle.classList.remove('active'); panelMass.classList.remove('hidden'); panelSingle.classList.add('hidden'); };

    // Поиск
    parseSingleBtn.onclick = async () => {
        const query = document.getElementById('search-query').value.trim();
        clearUI(); setLoading(true, parseSingleBtn);
        try {
            parsedData = await fetchSearchProducts(query);
            displayResults(parsedData);
            updateChart(parsedData);
        } catch (e) { showError(e.message); }
        finally { setLoading(false, parseSingleBtn, "Спарсить товары"); }
    };

    // Массовый
    parseMassBtn.onclick = async () => {
        const sellerId = document.getElementById('seller-id').value.trim();
        const brandId = document.getElementById('brand-id').value.trim();
        clearUI(); setLoading(true, parseMassBtn);
        try {
            parsedData = await fetchMassProducts(sellerId, brandId);
            displayResults(parsedData);
            updateChart(parsedData);
        } catch (e) { showError(e.message); }
        finally { setLoading(false, parseMassBtn, "Спарсить все товары"); }
    };

    // Отображение
    function displayResults(products) {
        tableBody.innerHTML = '';
        if (!products.length) { showError("Ничего не найдено."); return; }
        products.forEach(p => {
            const tr = document.createElement('tr');
            tr.className = "border-b";
            tr.style.borderColor = "var(--tg-bg)";
            tr.innerHTML = `<td class="py-3 px-4">${p.id}</td><td class="py-3 px-4 font-medium">${p.name}</td><td class="py-3 px-4">${p.brand}</td><td class="py-3 px-4">${p.price} ₽</td><td class="py-3 px-4">${p.rating}</td><td class="py-3 px-4">${p.reviews}</td><td class="py-3 px-4">${p.stock}</td>`;
            tableBody.appendChild(tr);
        });
        resultsContainer.classList.remove('hidden');
    }

    // Диаграмма
    function updateChart(products) {
        const ctx = document.getElementById('resultsChart').getContext('2d');
        if (resultsChartInstance) resultsChartInstance.destroy();

        if (products.length === 1) {
            const p = products[0];
            resultsChartInstance = new Chart(ctx, { type: 'bar', data: { labels: ['Цена', 'Отзывы', 'Остаток'], datasets: [{ label: p.name.slice(0,20)+'...', data: [p.price, p.reviews, p.stock], backgroundColor: ['#5288C1','#76C7C0','#F3BA2F'] }] }, options: chartOptions() });
        } else if (products.length > 1) {
            resultsChartInstance = new Chart(ctx, { type: 'scatter', data: { datasets: [{ label: 'Цена vs Рейтинг', data: products.map(p => ({x: p.price, y: p.rating})), backgroundColor: '#5288C1' }] }, options: chartOptions({ x: { title: { display: true, text: 'Цена (₽)' }}, y: { title: { display: true, text: 'Рейтинг' }} }) });
        }
    }

    function chartOptions(scales = {}) {
        return { responsive: true, plugins: { legend: { labels: { color: 'var(--tg-text)' }}}, scales: { y: { beginAtZero: true, ticks: { color: 'var(--tg-hint)'}, grid: { color: 'var(--tg-secondary-bg)'}, ...scales.y }, x: { ticks: { color: 'var(--tg-hint)'}, grid: { display: false }, ...scales.x }}};
    }

    // Экспорт
    exportBtn.onclick = () => {
        if (!parsedData.length) return;
        const ws = XLSX.utils.json_to_sheet(parsedData.map(p => ({ Артикул: p.id, Название: p.name, Бренд: p.brand, Цена: p.price, Рейтинг: p.rating, Отзывы: p.reviews, Остаток: p.stock })));
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Товары");
        XLSX.writeFile(wb, `wb_${Date.now()}.xlsx`);
    };

    // UI
    function setLoading(on, btn, text = "") {
        loadingEl.classList.toggle('hidden', !on); loadingEl.classList.toggle('flex', on);
        if (btn) { btn.disabled = on; btn.innerHTML = on ? `<div class="loader"></div>` : `<span>${text}</span>`; }
    }
    function showError(msg) { errorEl.textContent = `Ошибка: ${msg}`; errorEl.classList.remove('hidden'); }
    function clearUI() { errorEl.classList.add('hidden'); resultsContainer.classList.add('hidden'); tableBody.innerHTML = ''; parsedData = []; if (resultsChartInstance) resultsChartInstance.destroy(); }
});
