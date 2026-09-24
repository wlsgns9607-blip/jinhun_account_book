(function(){
  "use strict";

  var STORAGE_KEY = 'household-budget-v1';
  var THEME_KEY = 'household-budget-theme';

  var DEFAULT_ASSET_KEYS = ['토스','카카오뱅크','세이프뱅크','주식','KB국민은행','농협'];
  var DEFAULT_ASSETS = {'토스':298000,'카카오뱅크':0,'세이프뱅크':5850000,'주식':1470000,'KB국민은행':0,'농협':0};
  var MONTHS = ['9월','10월','11월','12월','1월','2월'];
  var CATEGORIES = ['현대카드 할부','현대카드 결제','식비','교통비','미용비','PC방','취미','월세','관리비','통신비','생활용품','기타'];
  var INCOME_CATEGORIES = ['월급','국취제 훈련자금','토스로 계좌이체','용돈','기타'];
  var INCOME_DESTINATIONS = {
    '월급': '토스',
    '국취제 훈련자금': 'KB국민은행',
    '토스로 계좌이체': '토스',
    '용돈': '토스',
    '기타': '토스'
  };

  function field(value){ return { raw:String(value), value:Number(value)||0 }; }

  function buildDefaultState(){
    var assetKeys = DEFAULT_ASSET_KEYS.slice();
    var assets = {};
    assetKeys.forEach(function(k){
      assets[k] = field(DEFAULT_ASSETS[k] !== undefined ? DEFAULT_ASSETS[k] : 0);
    });
    var expenses = {};
    var income = {};
    MONTHS.forEach(function(m){
      expenses[m] = {};
      CATEGORIES.forEach(function(c){ expenses[m][c] = field(0); });
      income[m] = {};
      INCOME_CATEGORIES.forEach(function(c){ income[m][c] = field(0); });
    });
    return { assetKeys:assetKeys, assets:assets, expenses:expenses, income:income, activeMonth:MONTHS[0] };
  }

  function loadState(){
    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return buildDefaultState();
      var parsed = JSON.parse(raw);
      var base = buildDefaultState();

      // Load assetKeys
      var keys = parsed.assetKeys;
      if(!Array.isArray(keys)){
        keys = (parsed.assets ? Object.keys(parsed.assets) : DEFAULT_ASSET_KEYS);
      }
      var seen = {};
      var cleanKeys = [];
      keys.forEach(function(k){
        if(typeof k === 'string' && k.trim() !== '' && !seen[k]){
          seen[k] = true;
          cleanKeys.push(k);
        }
      });
      if(cleanKeys.length === 0) cleanKeys = DEFAULT_ASSET_KEYS.slice();
      base.assetKeys = cleanKeys;
      base.assets = {};
      base.assetKeys.forEach(function(k){
        if(parsed.assets && parsed.assets[k]){
          base.assets[k] = parsed.assets[k];
        } else {
          base.assets[k] = field(DEFAULT_ASSETS[k] !== undefined ? DEFAULT_ASSETS[k] : 0);
        }
      });

      // 기존 저장된 토스 값이 구 기본값(294383)이거나 0이었던 경우 298000으로 보정
      if(base.assets['토스'] && (base.assets['토스'].value === 294383 || base.assets['토스'].value === 0)){
        base.assets['토스'] = field(298000);
      }

      MONTHS.forEach(function(m){
        CATEGORIES.forEach(function(c){
          if(parsed.expenses && parsed.expenses[m] && parsed.expenses[m][c]){
            base.expenses[m][c] = parsed.expenses[m][c];
          }
        });
        INCOME_CATEGORIES.forEach(function(c){
          if(parsed.income && parsed.income[m] && parsed.income[m][c]){
            base.income[m][c] = parsed.income[m][c];
          }
        });
      });
      if(parsed.activeMonth && MONTHS.indexOf(parsed.activeMonth) !== -1){
        base.activeMonth = parsed.activeMonth;
      }
      return base;
    }catch(e){
      return buildDefaultState();
    }
  }

  var state = loadState();

  function saveState(){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch(e){ /* storage unavailable — continue in-memory only */ }
  }

  function evaluateFormula(input){
    var trimmed = (input || '').trim().replace(/,/g,'');
    if(trimmed === '') return 0;
    if(!/^[0-9+\-*/().\s]+$/.test(trimmed)) return null;
    if(/[+\-*/.]$/.test(trimmed)) return null;
    try{
      var result = Function('"use strict"; return (' + trimmed + ')')();
      if(typeof result !== 'number' || !isFinite(result)) return null;
      return result;
    }catch(e){ return null; }
  }

  function formatWon(n){
    var rounded = Math.round(n);
    var sign = rounded < 0 ? '-' : '';
    return sign + Math.abs(rounded).toLocaleString('ko-KR') + '원';
  }
  function formatWonBig(n){
    var rounded = Math.round(n);
    var sign = rounded < 0 ? '-' : '';
    return sign + '₩' + Math.abs(rounded).toLocaleString('ko-KR');
  }

  function makeMoneyInput(fieldData, onCommit){
    var wrap = document.createElement('div');
    wrap.className = 'field-wrap';

    var input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.autocorrect = 'off';
    input.autocapitalize = 'off';
    input.spellcheck = false;
    input.className = 'money-input';
    input.value = formatWon(fieldData.value);

    var hint = document.createElement('div');
    hint.className = 'formula-hint';
    if(/[+\-*/()]/.test(fieldData.raw)) hint.textContent = '= ' + fieldData.raw;

    input.addEventListener('focus', function(){
      input.value = fieldData.raw;
      wrap.classList.add('is-focused');
    });

    function commit(keepFocus){
      var val = input.value.trim();
      var result = evaluateFormula(val === '' ? '0' : val);
      if(result === null){
        input.classList.add('input-error');
        setTimeout(function(){ input.classList.remove('input-error'); }, 350);
        input.value = formatWon(fieldData.value);
        return;
      }
      fieldData.raw = (val === '' ? '0' : val);
      fieldData.value = result;
      if(!keepFocus && document.activeElement !== input){
        input.value = formatWon(result);
      }
      hint.textContent = /[+\-*/()]/.test(fieldData.raw) ? '= ' + fieldData.raw : '';
      onCommit();
    }

    input.addEventListener('blur', function(){
      wrap.classList.remove('is-focused');
      commit(false);
    });

    input.addEventListener('keydown', function(e){
      if(e.key === 'Enter'){ e.preventDefault(); input.blur(); }
    });

    wrap.appendChild(input);
    wrap.appendChild(hint);
    return wrap;
  }

  function findKbKey(){
    if(state.assets['KB국민은행']) return 'KB국민은행';
    if(state.assets['국민은행']) return '국민은행';
    for(var i=0; i<state.assetKeys.length; i++){
      if(state.assetKeys[i].indexOf('국민') !== -1 || state.assetKeys[i].indexOf('KB') !== -1){
        return state.assetKeys[i];
      }
    }
    return 'KB국민은행';
  }

  function findTossKey(){
    if(state.assets['토스']) return '토스';
    for(var i=0; i<state.assetKeys.length; i++){
      if(state.assetKeys[i].indexOf('토스') !== -1){
        return state.assetKeys[i];
      }
    }
    return '토스';
  }

  function getAssetIncome(key, month){
    var targetMonth = month || state.activeMonth;
    var tossKey = findTossKey();
    var kbKey = findKbKey();
    if(key === tossKey){
      return incomeSumByAccount(targetMonth, '토스');
    }
    if(key === kbKey){
      return incomeSumByAccount(targetMonth, 'KB국민은행');
    }
    return 0;
  }

  function getAssetTotalValue(key, month){
    var baseVal = (state.assets[key] ? state.assets[key].value : 0);
    return baseVal + getAssetIncome(key, month);
  }

  // ---- Assets ----
  var assetGrid = document.getElementById('assetGrid');
  function renderAssets(){
    assetGrid.innerHTML = '';
    state.assetKeys.forEach(function(key){
      var card = document.createElement('div');
      card.className = 'asset-card';

      var header = document.createElement('div');
      header.className = 'asset-card-header';

      var label = document.createElement('label');
      label.textContent = key;
      label.title = key;
      header.appendChild(label);

      var incomeAdd = getAssetIncome(key, state.activeMonth);
      if(incomeAdd > 0){
        var badge = document.createElement('span');
        badge.className = 'dest-badge ' + (key === findKbKey() ? 'kb' : 'toss');
        badge.textContent = '+입금 ' + formatWon(incomeAdd);
        header.appendChild(badge);
      }

      var delBtn = document.createElement('button');
      delBtn.className = 'asset-delete-btn';
      delBtn.type = 'button';
      delBtn.innerHTML = '&minus;';
      delBtn.title = key + ' 삭제';
      delBtn.setAttribute('aria-label', key + ' 삭제');
      delBtn.addEventListener('click', function(){
        deleteAsset(key);
      });
      header.appendChild(delBtn);

      card.appendChild(header);

      var inputWrap = makeMoneyInput(state.assets[key], function(){
        recomputeAll();
        renderAssets();
      });
      card.appendChild(inputWrap);

      if(incomeAdd > 0){
        var sumHint = document.createElement('div');
        sumHint.className = 'asset-sum-hint';
        sumHint.textContent = '합계 ' + formatWon(getAssetTotalValue(key, state.activeMonth));
        card.appendChild(sumHint);
      }

      assetGrid.appendChild(card);
    });
  }

  function addAsset(name){
    var trimmed = (name || '').trim();
    if(!trimmed){
      return;
    }
    if(state.assetKeys.indexOf(trimmed) !== -1){
      alert('이미 존재하는 자산 항목입니다: ' + trimmed);
      return;
    }
    state.assetKeys.push(trimmed);
    state.assets[trimmed] = field(0);
    saveState();
    renderAssets();
    recomputeAll();
  }

  function deleteAsset(key){
    if(state.assetKeys.length <= 1){
      alert('최소 1개 이상의 자산 항목이 필요합니다.');
      return;
    }
    if(window.confirm('"' + key + '" 자산 항목을 삭제하시겠습니까?')){
      var idx = state.assetKeys.indexOf(key);
      if(idx !== -1){
        state.assetKeys.splice(idx, 1);
      }
      delete state.assets[key];
      saveState();
      renderAssets();
      recomputeAll();
    }
  }

  var addAssetBtn = document.getElementById('addAssetBtn');
  if(addAssetBtn){
    addAssetBtn.addEventListener('click', function(){
      var name = prompt('추가할 자산(통장/계좌/자산) 이름을 입력하세요:');
      if(name !== null){
        addAsset(name);
      }
    });
  }

  // ---- Month tabs + expense ledger ----
  var monthTabsEl = document.getElementById('monthTabs');
  var expenseRowsEl = document.getElementById('expenseRows');
  var activeMonthLabel = document.getElementById('activeMonthLabel');

  function renderMonthTabs(){
    monthTabsEl.innerHTML = '';
    MONTHS.forEach(function(m){
      var btn = document.createElement('button');
      btn.className = 'month-tab' + (m === state.activeMonth ? ' active' : '');
      btn.textContent = m;
      btn.addEventListener('click', function(){
        state.activeMonth = m;
        saveState();
        renderMonthTabs();
        renderAssets();
        renderIncomeRows();
        renderExpenseRows();
        recomputeAll();
      });
      monthTabsEl.appendChild(btn);
    });
  }

  function renderExpenseRows(){
    expenseRowsEl.innerHTML = '';
    activeMonthLabel.textContent = state.activeMonth;
    var monthData = state.expenses[state.activeMonth];
    CATEGORIES.forEach(function(cat){
      var row = document.createElement('div');
      row.className = 'ledger-row';
      var label = document.createElement('div');
      label.className = 'cat-label';
      label.textContent = cat;
      row.appendChild(label);
      row.appendChild(makeMoneyInput(monthData[cat], recomputeAll));
      expenseRowsEl.appendChild(row);
    });
    updateMonthTotal();
  }

  var incomeRowsEl = document.getElementById('incomeRows');
  var activeMonthLabelIncome = document.getElementById('activeMonthLabelIncome');

  function renderIncomeRows(){
    incomeRowsEl.innerHTML = '';
    activeMonthLabelIncome.textContent = state.activeMonth;
    var monthData = state.income[state.activeMonth];
    INCOME_CATEGORIES.forEach(function(cat){
      var row = document.createElement('div');
      row.className = 'ledger-row';
      var labelWrap = document.createElement('div');
      labelWrap.className = 'cat-label-wrap';
      var label = document.createElement('span');
      label.className = 'cat-label';
      label.textContent = cat;
      var dest = INCOME_DESTINATIONS[cat] || '토스';
      var badge = document.createElement('span');
      badge.className = 'dest-badge ' + (dest === 'KB국민은행' ? 'kb' : 'toss');
      badge.textContent = dest + ' 입금';
      labelWrap.appendChild(label);
      labelWrap.appendChild(badge);
      row.appendChild(labelWrap);
      row.appendChild(makeMoneyInput(monthData[cat], function(){
        renderAssets();
        recomputeAll();
      }));
      incomeRowsEl.appendChild(row);
    });
    updateIncomeTotal();
  }

  function monthSum(m){
    var sum = 0;
    CATEGORIES.forEach(function(c){ sum += state.expenses[m][c].value; });
    return sum;
  }

  function incomeSum(m){
    var sum = 0;
    INCOME_CATEGORIES.forEach(function(c){ sum += state.income[m][c].value; });
    return sum;
  }

  function incomeSumByAccount(m, account){
    var sum = 0;
    INCOME_CATEGORIES.forEach(function(c){
      var dest = INCOME_DESTINATIONS[c] || '토스';
      if(dest === account){
        sum += state.income[m][c].value;
      }
    });
    return sum;
  }

  function updateMonthTotal(){
    document.getElementById('monthTotal').textContent = formatWonBig(monthSum(state.activeMonth));
  }

  function updateIncomeTotal(){
    document.getElementById('incomeTotal').textContent = formatWonBig(incomeSum(state.activeMonth));
  }

  function assetSum(){
    var sum = 0;
    state.assetKeys.forEach(function(k){
      sum += getAssetTotalValue(k, state.activeMonth);
    });
    return sum;
  }

  function totalExpenseAllMonths(){
    var sum = 0;
    MONTHS.forEach(function(m){ sum += monthSum(m); });
    return sum;
  }

  function totalIncomeAllMonths(){
    var sum = 0;
    MONTHS.forEach(function(m){ sum += incomeSum(m); });
    return sum;
  }

  function recomputeAll(){
    saveState();
    var totalAssets = assetSum();
    var totalExpense = totalExpenseAllMonths();
    var totalIncome = totalIncomeAllMonths();
    var remaining = totalAssets + totalIncome - totalExpense;

    document.getElementById('assetTotal').textContent = formatWonBig(totalAssets);
    document.getElementById('sumAssets').textContent = formatWonBig(totalAssets);
    document.getElementById('sumIncome').textContent = formatWonBig(totalIncome);
    document.getElementById('sumExpense').textContent = formatWonBig(totalExpense);

    var remainEl = document.getElementById('sumRemaining');
    remainEl.textContent = formatWonBig(remaining);
    remainEl.classList.toggle('positive', remaining >= 0);
    remainEl.classList.toggle('negative', remaining < 0);

    // 토스 예상 잔액: 토스 총잔액(기본 토스 자산 298,000 + 이번 달 토스 입금 합계) - 이번 달 총지출
    var tossKey = findTossKey();
    var tossTotal = getAssetTotalValue(tossKey, state.activeMonth);
    var tossValue = tossTotal - monthSum(state.activeMonth);
    var tossEl = document.getElementById('tossEstimate');
    if(tossEl){
      tossEl.textContent = formatWonBig(tossValue);
      tossEl.classList.toggle('accent', tossValue >= 0);
      tossEl.classList.toggle('negative', tossValue < 0);
    }

    // KB국민은행 잔액: KB국민은행 총잔액(기본 자산 + 이번 달 국취제 훈련자금)
    var kbKey = findKbKey();
    var kbTotal = getAssetTotalValue(kbKey, state.activeMonth);
    var kbEl = document.getElementById('kbEstimate');
    if(kbEl){
      kbEl.textContent = formatWonBig(kbTotal);
      kbEl.classList.toggle('accent', kbTotal >= 0);
      kbEl.classList.toggle('negative', kbTotal < 0);
    }

    updateMonthTotal();
    updateIncomeTotal();
  }

  // ---- Theme ----
  var themeToggle = document.getElementById('themeToggle');
  function applyTheme(theme){
    if(theme){
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    themeToggle.textContent = (theme === 'dark') ? '☀' : '🌙';
  }
  function currentEffectiveIsDark(){
    var attr = document.documentElement.getAttribute('data-theme');
    if(attr === 'dark') return true;
    if(attr === 'light') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  (function initTheme(){
    var saved = null;
    try{ saved = localStorage.getItem(THEME_KEY); }catch(e){}
    applyTheme(saved);
  })();
  themeToggle.addEventListener('click', function(){
    var next = currentEffectiveIsDark() ? 'light' : 'dark';
    applyTheme(next);
    try{ localStorage.setItem(THEME_KEY, next); }catch(e){}
  });

  // ---- Reset ----
  document.getElementById('resetBtn').addEventListener('click', function(){
    if(window.confirm('모든 자산과 지출 데이터를 초기화할까요? 이 작업은 되돌릴 수 없습니다.')){
      state = buildDefaultState();
      saveState();
      renderAssets();
      renderMonthTabs();
      renderIncomeRows();
      renderExpenseRows();
      recomputeAll();
    }
  });

  // ---- init ----
  renderAssets();
  renderMonthTabs();
  renderIncomeRows();
  renderExpenseRows();
  recomputeAll();
})();

