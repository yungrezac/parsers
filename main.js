// --- Глобальные переменные ---
let parsedData = []; // Всегда храним массив продуктов
let resultsChartInstance = null;

// *** ВАЖНО: URL ТВОЕГО БЭКЕНДА ***
// Когда у тебя будет бэкенд, замени это на его URL
// Пример для локального теста: "http://127.0.0.1:5000"
const API_BASE_URL = "https://cerulean-heliotrope-6d46ff.netlify.app"; 

// --- Мок-данные (Симуляция ответа сервера) ---
// (Используются, если настоящий API_BASE_URL не отвечает)

const MOCK_PRODUCT_1 = {
    id: 12345678, name: "Увлажняющий крем 'Aqua-Boost'", brand: "BeautyNature", price: 1250.00, rating: 4.8, reviews: 1890, stock: 450,
    params: { "Назначение": "Увлажнение", "Тип кожи": "Сухая", "Объем": "50 мл" }
};
const MOCK_PRODUCT_2 = {
    id: 87654321, name: "Сыворотка с Витамином C", brand: "GlowUp", price: 2100.00, rating: 4.9, reviews: 5120, stock: 150,
    params: { "Назначение": "Сияние", "Актив": "Витамин C", "Объем": "30 мл" }
};
const MOCK_PRODUCT_3 = {
    id: 11223344, name: "Маска для лица глиняная", brand: "PureSkin", price: 850.00, rating: 4.6, reviews: 950, stock: 300,
    params: { "Назначение": "Очищение", "Тип кожи": "Жирная", "Объем": "100 мл" }
};
const MOCK_MASS_PRODUCTS = [MOCK_PRODUCT_1, MOCK_PRODUCT_2, MOCK_PRODUCT_3];

// --- API ЗАПРОСЫ (с фолбэком на симуляцию) ---

// Парсинг 1 товара
async function fetchSingleProduct(articleId) {
    if (!articleId) throw new Error("Артикул не может быть пустым.");
    
    try {
        // *** НАСТОЯЩИЙ КОД: ***
        const response = await fetch(`${API_BASE_URL}/parse-single?article=${articleId}`);
        if (!response.ok) throw new Error(`Ошибка сети: ${response.statusText}`);
        return await response.json();
    } catch (e) {
        console.warn(`Ошибка API (fetchSingleProduct), используем симуляцию. Ошибка: ${e.message}`);
        // *** СИМУЛЯЦИЯ (Фолбэк): ***
        return new Promise(resolve => {
            setTimeout(() => resolve({ ...MOCK_PRODUCT_1, id: articleId }), 1000);
        });
    }
}

// Массовый парсинг
async function fetchMassProducts(sellerId, brandId) {
    if (!sellerId && !brandId) throw new Error("Нужно указать ID Магазина или ID Бренда.");
    
    try {
        // *** НАСТОЯЩИЙ КОД: ***
        const response = await fetch(`${API_BASE_URL}/parse-mass?seller=${sellerId}&brand=${brandId}`);
        if (!response.ok) throw new Error(`Ошибка сети: ${response.statusText}`);
        return await response.json();
    } catch (e) {
        console.warn(`Ошибка API (fetchMassProducts), используем симуляцию. Ошибка: ${e.message}`);
        // *** СИМУЛЯЦИЯ (Фолбэк): ***
        return new Promise(resolve => {
            setTimeout(() => resolve(MOCK_MASS_PRODUCTS), 1500);
        });
    }
}

// --- Инициализация приложения ---
// Ждем, пока весь DOM-контент загрузится
document.addEventListener('DOMContentLoaded', () => {
    // Инициализация TWA
    try {
        if (window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.ready();
            window.Telegram.WebApp.expand();
        }
    } catch (e) { console.error("Ошибка инициализации TWA:", e); }

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
    if(tabSingle) {
        tabSingle.addEventListener('click', () => {
            tabSingle.classList.add('active');
            tabMass.classList.remove('active');
            panelSingle.classList.remove('hidden');
            panelMass.classList.add('hidden');
        });
    }

    if(tabMass) {
        tabMass.addEventListener('click', () => {
            tabMass.classList.add('active');
            tabSingle.classList.remove('active');
            panelMass.classList.remove('hidden');
            panelSingle.classList.add('hidden');
        });
    }

    // --- Логика парсинга ---
    
    // Парсинг 1 товара
    if(parseSingleBtn) {
        parseSingleBtn.addEventListener('click', async () => {
            const articleId = document.getElementById('article').value;
            clearUI();
            setLoading(true, parseSingleBtn);
            
            try {
                const data = await fetchSingleProduct(articleId);
                parsedData = [data]; // Сохраняем как массив
                displayResults(parsedData);
                updateChart(parsedData);
            } catch (error) {
                showError(error.message);
            } finally {
                setLoading(false, parseSingleBtn, "Спарсить товар");
            }
        });
    }

    // Массовый парсинг
    if(parseMassBtn) {
        parseMassBtn.addEventListener('click', async () => {
            const sellerId = document.getElementById('seller-id').value;
            const brandId = document.getElementById('brand-id').value;
            clearUI();
            setLoading(true, parseMassBtn);
            
            try {
                const data = await fetchMassProducts(sellerId, brandId);
                parsedData = data; // Сохраняем массив
                displayResults(parsedData);
                updateChart(parsedData);
            } catch (error) {
                showError(error.message);
            } finally {
                setLoading(false, parseMassBtn, "Спарсить все товары");
            }
        });
    }
    
    // --- Логика отображения ---

    function displayResults(products) {
        if (!tableBody) return;
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
                <td class="py-3 px-4">${p.id || 'N/A'}</td>
                <td class="py-3 px-4 font-medium">${p.name || 'N/A'}</td>
                <td class="py-3 px-4">${p.brand || 'N/A'}</td>
                <td class="py-3 px-4">${p.price || 0} ₽</td>
                <td class="py-3 px-4">${p.rating || 0}</td>
                <td class="py-3 px-4">${p.reviews || 0}</td>
                <td class="py-3 px-4">${p.stock || 0}</td>
            `;
            tableBody.appendChild(tr);
        });
        
        if (resultsContainer) resultsContainer.classList.remove('hidden');
    }

    // --- "Умная" диаграмма ---
    function updateChart(products) {
        const ctx = document.getElementById('resultsChart')?.getContext('2d');
        if (!ctx) return;
        
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
                        label: `Аналитика: ${String(p.name || 'Товар').substring(0, 20)}...`,
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
            plugins: { legend: { labels: { color: 'var(--tg-text, #FFF)' } } },
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: { color: 'var(--tg-hint, #AAA)' },
                    grid: { color: 'var(--tg-secondary-bg, #333)' },
                    ...scales.y
                },
                x: { 
                    ticks: { color: 'var(--tg-hint, #AAA)' },
                    grid: { display: false },
                    ...scales.x
                }
            }
        };
    }

    // --- Экспорт в Excel ---
    if (exportBtn) {
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
            
            if (window.XLSX) {
                const ws = window.XLSX.utils.json_to_sheet(flatData);
                const wb = window.XLSX.utils.book_new();
                window.XLSX.utils.book_append_sheet(wb, ws, "ParsedProducts");
                window.XLSX.writeFile(wb, `wb_export_${Date.now()}.xlsx`);
            } else {
                console.error("Библиотека XLSX (SheetJS) не найдена.");
                showError("Ошибка: Не удалось загрузить библиотеку для Excel.");
            }
        });
    }

    // --- Вспомогательные функции UI ---
    function setLoading(isLoading, btnElement, btnText = "") {
        if (loadingEl) loadingEl.classList.toggle('hidden', !isLoading);
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
        if (errorEl) {
            errorEl.textContent = `Ошибка: ${message}`;
            errorEl.classList.remove('hidden');
        }
    }
    
    function clearUI() {
        if (errorEl) errorEl.classList.add('hidden');
        if (resultsContainer) resultsContainer.classList.add('hidden');
        if (tableBody) tableBody.innerHTML = '';
        parsedData = [];
        if (resultsChartInstance) resultsChartInstance.destroy();
    }
});
