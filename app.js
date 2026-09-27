const rowsEl = document.querySelector('#rows');
const resultEl = document.querySelector('#result');
const rowTemplate = document.querySelector('#rowTemplate');
const modeEl = document.querySelector('#mode');
const titleEl = document.querySelector('#title');
const historyEl = document.querySelector('#history');

const HISTORY_KEY = 'alcocalc_history_v1';

const units = {
  volume: [
    { value: 'ml', label: 'мл', factor: 1 },
    { value: 'l', label: 'л', factor: 1000 }
  ],
  weight: [
    { value: 'g', label: 'г', factor: 1 },
    { value: 'kg', label: 'кг', factor: 1000 }
  ]
};

function formatNumber(value, digits = 2) {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: digits
  }).format(value);
}

function baseLabel() {
  return modeEl.value === 'volume' ? '100 мл' : '100 г';
}

function addRow(data = {}) {
  const node = rowTemplate.content.cloneNode(true);
  const row = node.querySelector('.calc-row');
  const amount = row.querySelector('.amount');
  const unit = row.querySelector('.unit');
  const price = row.querySelector('.price');
  const remove = row.querySelector('.remove');

  fillUnitOptions(unit, data.unit);

  amount.value = data.amount ?? '';
  price.value = data.price ?? '';

  amount.addEventListener('input', calculate);
  unit.addEventListener('change', calculate);
  price.addEventListener('input', calculate);

  remove.addEventListener('click', () => {
    if (rowsEl.children.length <= 2) return;
    row.remove();
    calculate();
  });

  rowsEl.appendChild(node);
}

function fillUnitOptions(select, selectedValue) {
  select.innerHTML = '';
  for (const item of units[modeEl.value]) {
    const option = document.createElement('option');
    option.value = item.value;
    option.textContent = item.label;
    if (selectedValue === item.value) option.selected = true;
    select.appendChild(option);
  }
}

function refreshUnits() {
  document.querySelectorAll('.unit').forEach(select => fillUnitOptions(select));
  calculate();
}

function readRows() {
  return [...document.querySelectorAll('.calc-row')]
    .map((row, index) => {
      const amount = Number(row.querySelector('.amount').value);
      const unitValue = row.querySelector('.unit').value;
      const price = Number(row.querySelector('.price').value);
      const unit = units[modeEl.value].find(item => item.value === unitValue);

      if (!amount || !price || !unit) return null;

      const baseAmount = amount * unit.factor;
      const pricePer100 = price / baseAmount * 100;

      return {
        index,
        amount,
        unit: unitValue,
        price,
        baseAmount,
        pricePer100
      };
    })
    .filter(Boolean);
}

function unitLabel(value) {
  return units[modeEl.value].find(item => item.value === value)?.label ?? value;
}

function calculate() {
  const items = readRows();

  if (items.length < 2) {
    resultEl.classList.add('hidden');
    resultEl.innerHTML = '';
    return;
  }

  const sorted = [...items].sort((a, b) => a.pricePer100 - b.pricePer100);
  const best = sorted[0];

  const comparisons = sorted.slice(1).map(item => {
    const moreExpensivePercent = ((item.pricePer100 - best.pricePer100) / best.pricePer100) * 100;
    const savingPercent = ((item.pricePer100 - best.pricePer100) / item.pricePer100) * 100;

    return `
      <div class="comparison">
        <div>
          <strong>${formatNumber(item.amount)} ${unitLabel(item.unit)} за ${formatNumber(item.price)} ₽</strong>
          <div class="meta">${formatNumber(item.pricePer100)} ₽ / ${baseLabel()}</div>
        </div>
        <div class="delta">
          дороже на ${formatNumber(moreExpensivePercent)}%
          <div class="meta">экономия с лучшим: ${formatNumber(savingPercent)}%</div>
        </div>
      </div>
    `;
  }).join('');

  resultEl.innerHTML = `
    <div class="winner">
      <div class="small">Самый выгодный вариант</div>
      <h2>${formatNumber(best.amount)} ${unitLabel(best.unit)} за ${formatNumber(best.price)} ₽</h2>
      <div class="winner-price">${formatNumber(best.pricePer100)} ₽ / ${baseLabel()}</div>
    </div>
    <div class="comparison-list">${comparisons}</div>
  `;

  resultEl.classList.remove('hidden');
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) ?? [];
  } catch {
    return [];
  }
}

function setHistory(items) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
}

function saveHistory() {
  const items = readRows();
  if (items.length < 2) {
    alert('Заполните хотя бы два варианта.');
    return;
  }

  const best = [...items].sort((a, b) => a.pricePer100 - b.pricePer100)[0];
  const history = getHistory();

  history.unshift({
    id: Date.now(),
    date: new Date().toISOString(),
    title: titleEl.value.trim() || 'Без названия',
    mode: modeEl.value,
    items: items.map(({ amount, unit, price }) => ({ amount, unit, price })),
    best: {
      amount: best.amount,
      unit: best.unit,
      price: best.price
    }
  });

  setHistory(history.slice(0, 50));
  renderHistory();
}

function restoreHistoryItem(entry) {
  modeEl.value = entry.mode || 'volume';
  titleEl.value = entry.title === 'Без названия' ? '' : entry.title;
  rowsEl.innerHTML = '';

  entry.items.forEach(item => addRow(item));

  while (rowsEl.children.length < 2) addRow();
  calculate();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteHistoryItem(id) {
  setHistory(getHistory().filter(item => item.id !== id));
  renderHistory();
}

function renderHistory() {
  const history = getHistory();

  if (!history.length) {
    historyEl.innerHTML = '<p class="history-empty">Здесь появятся сохранённые сравнения.</p>';
    return;
  }

  historyEl.innerHTML = history.map(entry => {
    const date = new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(entry.date));

    return `
      <div class="history-item">
        <div>
          <div class="history-title">${escapeHtml(entry.title)}</div>
          <div class="history-meta">
            ${date}<br>
            Лучший: ${formatNumber(entry.best.amount)} ${entry.best.unit} за ${formatNumber(entry.best.price)} ₽
          </div>
        </div>
        <div>
          <button type="button" data-restore="${entry.id}">Открыть</button>
          <button type="button" data-delete="${entry.id}">Удалить</button>
        </div>
      </div>
    `;
  }).join('');

  historyEl.querySelectorAll('[data-restore]').forEach(button => {
    button.addEventListener('click', () => {
      const entry = getHistory().find(item => item.id === Number(button.dataset.restore));
      if (entry) restoreHistoryItem(entry);
    });
  });

  historyEl.querySelectorAll('[data-delete]').forEach(button => {
    button.addEventListener('click', () => deleteHistoryItem(Number(button.dataset.delete)));
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

document.querySelector('#addRow').addEventListener('click', () => addRow());
document.querySelector('#saveHistory').addEventListener('click', saveHistory);

document.querySelector('#clearHistory').addEventListener('click', () => {
  if (!getHistory().length) return;
  if (confirm('Очистить всю историю?')) {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
  }
});

modeEl.addEventListener('change', refreshUnits);

addRow({ amount: 0.5, unit: 'l', price: 1000 });
addRow({ amount: 0.7, unit: 'l', price: 1200 });
addRow({ amount: 1, unit: 'l', price: 1500 });

calculate();
renderHistory();
