// main.js
// --- Глобальные переменные ---
let parsedData = []; // Всегда храним массив продуктов
let resultsChartInstance = null;

// --- Вспомогательная функция для fetch с прокси ---
async function fetchJson(url) {
    const proxyUrl = 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url);
    const response = await fetch(proxyUrl);
    if (!response.ok) {
        throw new Error('Ошибка прокси: ' + response.status);
    }
    return await response.json();
}

// --- Парсинг по поиску ---
async function fetchSearchProducts(query) {
    if (!query) throw new Error("Название не может быть пустым.");
    
    const allProducts = [];
    let page = 1;
    const maxPages = 10; // Ограничение для скорости
    
    while (true) {
        const url = `https://search.wb.ru/exactmatch/ru/common/v5/search?ab_testing=false&appType=1&curr=rub&dest=-1257786&query=${encodeURIComponent(query)}&resultset=catalog&sort=popular&spp=30&suppressSpellcheck=false&page=${page}`;
        let data;
        try {
            data = await fetchJson(url);
        } catch (e) {
            throw new Error('Ошибка сети: ' + e.message);
        }
        
        if (!data.data || !data.data.products || data.data.products.length === 0) break;
        
        data.data.products.forEach(p => {
            let stock = 0;
            if (p.sizes) {
                p.sizes.forEach(s => {
                    if (s.stocks) {
                        s.stocks.forEach(st => stock += st.qty || 0);
                    } else {
                        stock += s.qty || 0;
                    }
                });
            }
            
            allProducts.push({
                id: p.id,
                name: p.name,
                brand: p.brand,
                price: p.salePriceU / 100,
                rating: p.reviewRating || 0,
                reviews: p.feedbacks || 0,
                stock: stock,
                params: {}  // Параметры не загружаются для поиска
            });
        });
        
        if (page >= maxPages || allProducts.length >= (data.data.total || allProducts.length)) break;
        page++;
        await new Promise(resolve => setTimeout(resolve, 500)); // Задержка
    }
    
    return allProducts;
}

// --- Массовый парсинг ---
async function fetchMassProducts(sellerId, brandId) {
    if (!sellerId && !brandId) throw new Error("Нужно указать ID Магазина или ID Бренда.");
    if (sellerId && brandId) throw new Error("Укажите только один: ID Магазина или ID Бренда.");
    
    let endpoint = '';
    if (sellerId) {
        endpoint = `https://catalog.wb.ru/sellers/v4/catalog?appType=1&curr=rub&dest=-1257786&sort=popular&spp=30&supplier=${sellerId}`;
    } else if (brandId) {
        endpoint = `https://catalog.wb.ru/brands/v2/catalog?appType=1&curr=rub&dest=-1257786&sort=popular&spp=30&brand=${brandId}`;
    }
    
    const allProducts = [];
    let page = 1;
    const maxPages = 10; // Ограничение для скорости
    
    while (true) {
        const url = `${endpoint}&page=${page}`;
        let data;
        try {
            data = await fetchJson(url);
        } catch (e) {
            throw new Error('Ошибка сети: ' + e.message);
        }
        
        if (!data.data || !data.data.products || data.data.products.length === 0) break;
        
        data.data.products.forEach(p => {
            let stock = 0;
            if (p.sizes) {
                p.sizes.forEach(s => {
                    if (s.stocks) {
                        s.stocks.forEach(st => stock += st.qty || 0);
                    } else {
                        stock += s.qty || 0;
                    }
                });
            }
            
            allProducts.push({
                id: p.id,
                name: p.name,
                brand: p.brand,
                price: p.salePriceU / 100,
                rating: p.reviewRating || p.rating || 0,
                reviews: p.feedbacks || p.feedbackCount || 0,
                stock: stock,
                params: {}  // Параметры не загружаются для массового парсинга
            });
        });
        
        if (page >= maxPages || allProducts.length >= (data.data.total || allProducts.length)) break;
        page++;
        await new Promise(resolve => setTimeout(resolve, 500)); // Задержка
    }
    
    return allProducts;
}

// --- Инициализация приложения ---
document.addEventListener('DOMContentLoaded', () => {
    // Инициализация TWA
    try {
        Telegram.WebApp.ready();
        Telegram.WebApp.expand();
    } catch (e) { console.error("Ошибка TWA:", e); }

    // Элементы DOM
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

    // --- Логика вкладок ---
    tabSingle.addEventListener('click', () => {
        tabSingle.classList.add('active');
        tabMass.classList.remove('active');
        panelSingle.classList.remove('hidden');
        panelMass.classList.add('hidden');
    });

    tabMass.addEventListener('click', () => {
        tabMass.classList.add('active');
        tabSingle.classList.remove('active');
        panelMass.classList.remove('hidden');
        panelSingle.classList.add('hidden');
    });

    // --- Логика парсинга ---
    
    // Парсинг по поиску
    parseSingleBtn.addEventListener('click', async () => {
        const query = document.getElementById('search-query').value.trim();
        clearUI();
        setLoading(true, parseSingleBtn);
        
        try {
            const data = await fetchSearchProducts(query);
            parsedData = data;
            displayResults(parsedData);
            updateChart(parsedData);
        } catch (error) {
            showError(error.message);
        } finally {
            setLoading(false, parseSingleBtn, "Спарсить товары");
        }
    });

    // Массовый парсинг
    parseMassBtn.addEventListener('click', async () => {
        const sellerId = document.getElementById('seller-id').value.trim();
        const brandId = document.getElementById('brand-id').value.trim();
        clearUI();
        setLoading(true, parseMassBtn);
        
        try {
            const data = await fetchMassProducts(sellerId, brandId);
            parsedData = data;
            displayResults(parsedData);
            updateChart(parsedData);
        } catch (error) {
            showError(error.message);
        } finally {
            setLoading(false, parseMassBtn, "Спарсить все товары");
        }
    });
    
    // --- Логика отображения ---

    function displayResults(products) {
        tableBody.innerHTML = ''; // Очистка
        if (!products || products.length === 0) {
            showError("Ничего не найдено.");
            return;
        }
        
        products.forEach(p => {
            const tr = document.createElement('tr');
            tr.className = "border-b";
            tr.style.borderColor = "var(--tg-bg)";
            tr.innerHTML = `
                <td class="py-3 px-4">${p.id}</td>
                <td class="py-3 px-4 font-medium">${p.name}</td>
                <td class="py-3 px-4">${p.brand}</td>
                <td class="py-3 px-4">${p.price} ₽</td>
                <td class="py-3 px-4">${p.rating}</td>
                <td class="py-3 px-4">${p.reviews}</td>
                <td class="py-3 px-4">${p.stock}</td>
            `;
            tableBody.appendChild(tr);
        });
        
        resultsContainer.classList.remove('hidden');
    }

    // --- "Умная" диаграмма ---
    function updateChart(products) {
        const ctx = document.getElementById('resultsChart').getContext('2d');
        if (resultsChartInstance) {
            resultsChartInstance.destroy();
        }

        if (products.length === 1) {
            // Диаграмма для 1 товара (Бар)
            const p = products[0];
            resultsChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Цена (₽)', 'Отзывы (шт)', 'Остаток (шт)'],
                    datasets: [{
                        label: `Аналитика: ${p.name.substring(0, 20)}...`,
                        data: [p.price, p.reviews, p.stock],
                        backgroundColor: ['#5288C1', '#76C7C0', '#F3BA2F'],
                    }]
                },
                options: chartOptions()
            });
        } else if (products.length > 1) {
            // Диаграмма для >1 товара (Scatter: Цена vs Рейтинг)
            const scatterData = products.map(p => ({ x: p.price, y: p.rating }));
            
            resultsChartInstance = new Chart(ctx, {
                type: 'scatter',
                data: {
                    datasets: [{
                        label: 'Цена vs. Рейтинг',
                        data: scatterData,
                        backgroundColor: '#5288C1',
                    }]
                },
                options: chartOptions({
                    x: { title: { display: true, text: 'Цена (₽)', color: 'var(--tg-text)' } },
                    y: { title: { display: true, text: 'Рейтинг', color: 'var(--tg-text)' } }
                })
            });
        }
    }
    
    // Общие настройки для всех диаграмм
    function chartOptions(scales = {}) {
        return {
            responsive: true,
            plugins: { legend: { labels: { color: 'var(--tg-text)' } } },
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: { color: 'var(--tg-hint)' },
                    grid: { color: 'var(--tg-secondary-bg)' },
                    ...scales.y
                },
                x: { 
                    ticks: { color: 'var(--tg-hint)' },
                    grid: { display: false },
                    ...scales.x
                }
            }
        };
    }

    // --- Экспорт в Excel ---
    exportBtn.addEventListener('click', () => {
        if (parsedData.length === 0) return;

        // Собираем все *уникальные* параметры (для косметики) со всех товаров
        const allParamKeys = new Set();
        parsedData.forEach(p => {
            if (p.params) Object.keys(p.params).forEach(k => allParamKeys.add(k));
        });
        const paramKeysArray = Array.from(allParamKeys);
        
        // Преобразуем данные в плоский формат
        const flatData = parsedData.map(p => {
            const base = {
                "Артикул": p.id,
                "Название": p.name,
                "Бренд": p.brand,
                "Цена": p.price,
                "Рейтинг": p.rating,
                "Отзывы": p.reviews,
                "Остаток": p.stock,
            };
            
            // Добавляем колонки для *каждого* уникального параметра
            paramKeysArray.forEach(key => {
                base[key] = p.params ? (p.params[key] || "") : "";
            });
            
            return base;
        });
        
        const ws = XLSX.utils.json_to_sheet(flatData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "ParsedProducts");
        XLSX.writeFile(wb, `wb_export_${Date.now()}.xlsx`);
    });

    // --- Вспомогательные функции UI ---
    function setLoading(isLoading, btnElement, btnText = "") {
        loadingEl.classList.toggle('hidden', !isLoading);
        loadingEl.classList.toggle('flex', isLoading);
        if (btnElement) {
            btnElement.disabled = isLoading;
            if (isLoading) {
                btnElement.innerHTML = `<div class="loader"></div>`;
            } else {
                btnElement.innerHTML = `<span>${btnText}</span>`;
            }
        }
    }
    
    function showError(message) {
        errorEl.textContent = `Ошибка: ${message}`;
        errorEl.classList.remove('hidden');
    }
    
    function clearUI() {
        errorEl.classList.add('hidden');
        resultsContainer.classList.add('hidden');
        tableBody.innerHTML = '';
        parsedData = [];
        if (resultsChartInstance) resultsChartInstance.destroy();
    }
});
