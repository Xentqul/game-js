"use strict";

// класс-игра (управляет игровым состоянием, логикой, рендером, взаимодействием с пользователем)
class Game {
  // конструктор - создаем экземляр игры и инициализирем начальные значения через контекст
  constructor() {
    // ===== ВСЕ КОНСТАНТЫ СОБРАНЫ ЗДЕСЬ =====
    this.CONST = {
      // здоровье и урон
      HERO_MAX_HEALTH: 100,
      HERO_BASE_POWER: 10,
      HERO_POTION_HEAL: 20,
      ENEMY_BASE_DAMAGE: 5,
      BOSS_BASE_DAMAGE: 10,
      ENEMY_HEALTH: 50, // здоровье обычного врага
      BOSS_HEALTH: 200, // здоровье босса
      ENEMY_HEALTH_LEVEL_3: 70, // здоровье врага на 3 уровне

      // генерация карты
      MIN_ROOMS: 5,
      MAX_ROOMS: 10,
      MIN_ROOM_WIDTH: 4,
      MAX_ROOM_WIDTH: 10,
      MIN_ROOM_HEIGHT: 4,
      MAX_ROOM_HEIGHT: 8,
      MIN_VERTICAL_PASSAGES: 3,
      MAX_VERTICAL_PASSAGES: 5,
      MIN_HORIZONTAL_PASSAGES: 3,
      MAX_HORIZONTAL_PASSAGES: 5,
      MAX_GEN_ATTEMPTS: 300, // максимум попыток генерации комнат

      // количество существ и предметов
      SWORDS_COUNT: 2,
      POTIONS_COUNT: 10,
      ENEMIES_COUNT: 10,
      ENEMIES_COUNT_LEVEL_3: 15,

      // прочее
      ENEMY_MOVE_INTERVAL: 1000, // интервал движения врагов (мс)
      ATTACK_HIGHLIGHT_DURATION: 300, // длительность подсветки атаки (мс)
      ITEM_EFFECT_DURATION: 500, // длительность эффекта предмета (мс)
      TILE_SIZE: 27, // размер тайла
    };

    this.field = null; //dom-элемент игрового поля
    this.inventorySlots = 5; //макс. кол-во слотов в инвентаре
    this.inventory = Array(this.inventorySlots).fill(null); // массив предметов в инвентаре
    this.selectedInventoryIndex = 0; // индекс выбранного слота инвентаря
    this.map = []; // двумерный массив (представляет игровую карту)
    this.hero = { x: 0, y: 0, health: 100, power: 10 }; // объект с хар-ми гг
    this.enemies = []; // массив врагов
    this.swords = []; // массив координат мечей на карте
    this.potions = []; // массив координат зелий на карте
    this.tileSize = this.CONST.TILE_SIZE; // размер 1ой клетки карты (px)
    this.mapWidth = 40; // ширина карты в клетках
    this.mapHeight = 24; // высота карты в клетках
    this.currentLevel = 1; // текущий уровень игры (1/2/3)
    this.enemyInterval = null; // иден-тор интервала для движения врагов
    this.handleKeyPress = null; // обработчик нажатий клавиш
    this.boss = null; // объект босса (на 3 лвле)
    this.isPaused = false; // флаг паузы, да/нет

    // система управления музыкой, треки и их состояния
    this.music = {
      menu: null, // звук для: меню
      pickup: null, // поднятие предмета
      fight: null, // бой
      nextLevel: null, // экран при прохождении уровня, переход на след уровень
      died: null, // экран смерти
      end: null, // экран финальной победы
    };
    this.currentTrack = null; // текущий трек
    this.musicEnabled = false; // разрешено ли воспроизведение музыки (для браузера, первичная блокировка без взаимодействия с пользователем звук не работает)
    this.musicQueue = null; // очередь для трека, что будет запущен после разблокировки
  }

  // ============================================================================
  // =========================== ИНИЦИАЛИЗАЦИЯ ИГРЫ =============================
  // ============================================================================

  init() {
    this.field = document.querySelector(".field");
    this.inventoryEl = document.querySelector(".inventory"); // не путать с массивом!!!
    this.initMusic(); // создаем аудио-объекты
    this.showStartScreen(); // Вся логика запуска здесь
    this.updateInventory();
    const settingsBtn = document.getElementById("settings-btn");
    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => {
        this.showSettingsMenu();
      });
    }
  }

  // ============================================================================
  // =========================== МУЗЫКАЛЬНАЯ СИСТЕМА ============================
  // ============================================================================

  initMusic() {
    // подключаем из папки music
    this.music.menu = new Audio("music/main-menu.mp3");
    this.music.pickup = new Audio("music/pick-smth.mp3");
    this.music.fight = new Audio("music/fight.mp3");
    this.music.nextLevel = new Audio("music/next-level.mp3");
    this.music.died = new Audio("music/died.mp3");
    this.music.end = new Audio("music/end.mp3");
    //  повтор трека, да/нет
    this.music.menu.loop = true;
    this.music.pickup.loop = false;
    this.music.fight.loop = true;
    this.music.nextLevel.loop = false;
    this.music.died.loop = false;
    this.music.end.loop = false;
    // громкость музыки по умолчанию
    this.music.menu.volume = 0.7;
    this.music.pickup.volume = 0.9;
    this.music.fight.volume = 0.6;
    this.music.nextLevel.volume = 0.7;
    this.music.died.volume = 0.7;
    this.music.end.volume = 0.7;
  }

playMusic(trackName) {
  // Возвращаем Promise, чтобы вызов this.playMusic(...).then(...) был корректен.
  // Если музыка ещё не разблокирована — возвращаем отклонённый промис.
  if (!this.musicEnabled) {
    this.musicQueue = trackName;
    return Promise.reject(new Error("music not enabled"));
  }

  // Звук подбора — допускаем наслоение (не прерываем основной трек).
  if (trackName === "pickup") {
    const pickupSound = this.music.pickup.cloneNode(true);
    pickupSound.volume = 0.9;
    const pickPromise = pickupSound.play();
    if (pickPromise !== undefined) {
      // возвращаем реальный промис, если браузер его дал
      return pickPromise;
    }
    return Promise.resolve();
  }

  // Останавливаем предыдущую музыку и начинаем новый трек
  this.stopMusic();

  this.currentTrack = this.music[trackName];
  if (!this.currentTrack) {
    return Promise.reject(new Error("track not found: " + trackName));
  }

  // Попытка воспроизвести - play() возвращает Promise в современных браузерах
  const playPromise = this.currentTrack.play();

  if (playPromise !== undefined) {
    // Если промис есть, обрабатываем случай блокировки автозапуска:
    return playPromise.catch((error) => {
      console.log("Автовоспроизведение заблокировано, ждем взаимодействия:", error);
      // верим логике: помечаем как заблокированное и ставим в очередь
      this.musicEnabled = false;
      this.musicQueue = trackName;
      // пробрасываем ошибку дальше, чтобы .catch сверху отрабатывал
      throw error;
    });
  } else {
    // В старых браузерах play() может не возвращать промис — просто резолв
    return Promise.resolve();
  }
}

  stopMusic() {
    // останавливаем ВСЕ треки, кроме звуков подбора
    for (const trackName in this.music) {
      if (this.music.hasOwnProperty(trackName) && trackName !== "pickup") {
        const track = this.music[trackName];
        track.pause();
        track.currentTime = 0; // перематываем на начало
      }
    }
    this.currentTrack = null; // сбрасываем текущий трек
  }

  // ============================================================================
  // =========================== ЭКРАНЫ ИГРЫ ====================================
  // ============================================================================
  // стартовый экран - глав. меню
showStartScreen() {
  const startScreen = document.getElementById("start-screen");
  if (!startScreen) return;

  startScreen.innerHTML = `
    <h1>РОГАЛИК: ПУТЬ РЕВОЛЮЦИОНЕРА</h1>
    <p style="font-size: 18px; max-width: 800px; line-height: 1.6;">
      Вы — участник восстания, переодетый рыцарем, чтобы пройти на территорию города.
      Ваш путь лежит через катакомбы прямо в замок.
      Опасности на каждом шагу. Будьте сильны. Удачи вам попасть в замок.
      <br><br>
      <strong>Слава революции!</strong>
    </p>
    <h3 style="margin-top: 40px;">УПРАВЛЕНИЕ:</h3>
    <p>
      WASD / ЦФЫВ — движение (вверх, влево, вниз, вправо).<br>
      Пробел — атака всех соседних врагов.<br>
      Использовать зелье - русская "У"/английская "E".<br>
      Слоты инвентаря - 1, 2, 3, 4, 5.<br>
      Удалить из инвентаря русская - "Е"/английская "T".<br>
      Зелья восстанавливают здоровье.<br>
      Мечи усиливают удары.<br>
      Зелья попадают в инвентарь, если здоровье персонажа 100%.
    </p>
    <button id="enable-music-btn" style="
      padding: 15px 30px;
      font-size: 20px;
      background: #33aa33;
      color: white;
      border: none;
      cursor: pointer;
      border-radius: 5px;
      margin-top: 20px;
    ">Включить музыку</button>
    <p id="music-message" style="color: white; font-size: 18px; margin-top: 20px; display: none;">
      Нажмите любую клавишу на клавиатуре для начала игры
    </p>
  `;

  let musicEnabledByButton = false;
  const enableMusicButton = document.getElementById("enable-music-btn");
  const musicMessage = document.getElementById("music-message");

  // обработчик для кнопки включения музыки
  enableMusicButton.addEventListener("click", () => {
    if (!musicEnabledByButton) {
      // === ВСЯ ЛОГИКА РАЗБЛОКИРОВКИ МУЗЫКИ ===
      this.musicEnabled = true;
      musicEnabledByButton = true;

      // попытка воспроизвести музыку меню
      this.playMusic("menu")
        .then(() => {
          // если удалось, сменить кнопку
          enableMusicButton.textContent = "Музыка включена!";
          enableMusicButton.style.background = "#555";
          enableMusicButton.disabled = true;
        })
        .catch((error) => {
          // если не удалось (блокировка браузера), оставить кнопку активной
          console.error("Не удалось воспроизвести музыку:", error);
          this.musicEnabled = false;
          musicEnabledByButton = false;
        });

      // показывать сообщение о том, что нужно нажать любую клавишу
      musicMessage.style.display = "block";
    }
  });

  // обработчик для ЛЮБОЙ клавиши клавиатуры
  const keyHandler = (e) => {
    // начинаем игру только если музыка была ВКЛЮЧЕНА ЧЕРЕЗ КНОПКУ
    if (musicEnabledByButton) {
      startScreen.style.display = "none";
      document.removeEventListener("keydown", keyHandler);
      this.stopMusic(); // останавливаем музыку меню
      this.startGame(); // запускаем игру и музыку боя
    }
  };

  document.addEventListener("keydown", keyHandler);
}

  startGame() {
    this.generateMap();
    this.renderMap();
    this.bindKeys();
    this.startEnemyMovement();
    this.playMusic("fight");
  }
  // экран смерти
  showGameOverScreen() {
    clearInterval(this.enemyInterval);
    this.stopMusic();
    this.playMusic("died");

    const gameOverDiv = document.createElement("div");
    gameOverDiv.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 1000; display: flex; flex-direction: column; justify-content: center; align-items: center; color: white; font-family: 'Playfair Display', serif; padding: 20px; text-align: center;">
        <h1 style="font-size: 48px; margin: 0;">ИГРА ОКОНЧЕНА</h1>
        <p style="font-size: 24px; margin: 30px 0; max-width: 800px; line-height: 1.6;">
          Вы сгинули в катакомбах, и революция сорвалась. 
          Король-тиран уничтожил всех участников движения и превратил в ужас жизнь обычных крестьян...
        </p>
        <button onclick="location.reload()" style="padding: 15px 30px; font-size: 20px; background: #ff3333; color: white; border: none; cursor: pointer; border-radius: 5px;">
          Начать заново
        </button>
      </div>
    `;
    document.body.appendChild(gameOverDiv);
  }

  showVictoryMessage() {
    if (document.getElementById("victory-overlay")) return;

    clearInterval(this.enemyInterval);
    this.stopMusic();
    this.playMusic("nextLevel");

    let message = "";
    let buttonText = "";

    if (this.currentLevel === 1) {
      message = `
        <h2 style="font-size: 32px;">Фух... Их больше, чем мы планировали...</h2>
        <p style="font-size: 24px; margin: 30px 0;">Но я не могу остановиться. Нужно идть дальше...</p>
      `;
      buttonText = "Продолжить путь";
    } else if (this.currentLevel === 2) {
      message = `
        <h2 style="font-size: 32px;">Знакомая планировка... Я уже близко.</h2>
        <p style="font-size: 24px; margin: 20px 0;">Где-то тут должен быть скрытый проход в подвал замка...</p>
        <p style="font-size: 24px; margin: 20px 0;">Кто это? Что!? Охрана! Меня заметили!</p>
        <p style="font-size: 24px; margin: 20px 0; font-style:italic;">Уничтожьте всех оставшихся врагов, а после сразитесь с элитной охраной дворца и свергните короля</p>
      `;
      buttonText = "В бой!";
    }

    const victoryDiv = document.createElement("div");
    victoryDiv.id = "victory-overlay";
    victoryDiv.innerHTML = `
    <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; display: flex; flex-direction: column; justify-content: center; align-items: center; color: white; font-family: 'Playfair Display', serif; padding: 20px; text-align: center;">
      ${message}
      <button id="continue-button" style="padding: 15px 30px; font-size: 20px; background: #33aa33; color: white; border: none; cursor: pointer; border-radius: 5px;">
        ${buttonText}
      </button>
    </div>
  `;
    document.body.appendChild(victoryDiv);

    victoryDiv.addEventListener("click", (e) => {
      if (
        e.target.id === "continue-button" ||
        e.target.closest("#continue-button")
      ) {
        victoryDiv.remove();
        this.startNextLevel();
      }
    });
  }

  showFinalVictory() {
    this.stopMusic();
    this.playMusic("end");

    const finalDiv = document.createElement("div");
    finalDiv.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; display: flex; flex-direction: column; justify-content: center; align-items: center; color: white; font-family: 'Playfair Display', serif; padding: 20px; text-align: center;">
        <h1 style="font-size: 48px; margin: 0;">ВЫ ПОБЕДИЛИ!</h1>
        <p style="font-size: 28px; margin: 30px 0; max-width: 800px; line-height: 1.6;">
          С вашей помощью революционное движение свергло короля-тирана, 
          и солнце вновь воцарилось над мирными землями!
        </p>
        <p style="font-size: 26px; margin: 30px 0; max-width: 800px; line-height: 1.6; color: green;">
          Надеюсь, Вам понравилось путешествие по катакомбам! Поделитесь впечатлениями и идеями по доработке игры: <a href="https://t.me/xentqul">@xentqul<a/>
        </p>
        <h2 style="font-size: 36px; margin: 20px 0;">Слава революции, слава Вам!</h2>
        <button onclick="location.reload()" style="padding: 15px 30px; font-size: 20px; background: #33aa33; color: white; border: none; cursor: pointer; border-radius: 5px; margin-top: 30px;">
          Начать заново
        </button>
      </div>
    `;
    document.body.appendChild(finalDiv);
  }

  // ============================================================================
  // =========================== НАСТРОЙКИ ======================================
  // ============================================================================

  togglePause() {
    this.isPaused = !this.isPaused;

    if (this.isPaused) {
      // остановить движение врагов
      if (this.enemyInterval) {
        clearInterval(this.enemyInterval);
        this.enemyInterval = null;
      }
      // ставим музыку на паузу (кроме pickup)
      if (this.currentTrack && this.currentTrack !== this.music.pickup) {
        this.currentTrack.pause();
      }
    } else {
      // возобновить движение
      this.startEnemyMovement();
      // возобновить музыку
      if (this.currentTrack && this.currentTrack !== this.music.pickup) {
        this.currentTrack
          .play()
          .catch((e) => console.log("Music resume failed:", e));
      }
    }
  }

  showSettingsMenu() {
    if (this.isPaused) return; // уже открыто

    this.togglePause(); // ставим игру на паузу

    const overlay = document.createElement("div");
    overlay.id = "settings-overlay";
    overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
    z-index: 2000;
    display: flex;
    justify-content: center;
    align-items: center;
    font-family: 'Playfair Display', serif;
  `;

    const menu = document.createElement("div");
    menu.style.cssText = `
    background: #111;
    padding: 30px;
    border: 2px solid #555;
    border-radius: 15px;
    color: white;
    text-align: center;
    max-width: 400px;
    box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
  `;

    menu.innerHTML = `
    <h2 style="margin: 0 0 25px 0; font-size: 28px;">НАСТРОЙКИ</h2>

    <div style="margin: 20px 0;">
      <label style="display: block; margin-bottom: 10px; font-size: 18px;">Громкость музыки</label>
      <input type="range" id="volume-slider" min="0" max="1" step="0.1" value="${
        this.music.menu.volume
      }" style="width: 80%;">
      <div id="volume-value" style="margin-top: 5px; font-size: 16px;">${Math.round(
        this.music.menu.volume * 100
      )}%</div>
    </div>

    <div style="margin: 25px 0; display: flex; flex-direction: column; gap: 12px;">
      <button id="btn-continue" style="padding: 12px; font-size: 18px; background: #33aa33; color: white; border: none; border-radius: 5px; cursor: pointer;">▶ Продолжить игру</button>
      <button id="btn-restart" style="padding: 12px; font-size: 18px; background: #ffaa00; color: black; border: none; border-radius: 5px; cursor: pointer;">🔄 Рестарт уровня</button>
      <button id="btn-exit" style="padding: 12px; font-size: 18px; background: #ff3333; color: white; border: none; border-radius: 5px; cursor: pointer;">🚪 Выйти в меню</button>
    </div>
  `;

    overlay.appendChild(menu);
    document.body.appendChild(overlay);

    // слайдер громкости
    const volumeSlider = menu.querySelector("#volume-slider");
    const volumeValue = menu.querySelector("#volume-value");

    const updateVolume = () => {
      const value = parseFloat(volumeSlider.value);
      volumeValue.textContent = Math.round(value * 100) + "%";
      for (const key in this.music) {
        if (this.music[key] && key !== "pickup") {
          this.music[key].volume = value;
        }
      }
      if (this.currentTrack && this.currentTrack !== this.music.pickup) {
        this.currentTrack.volume = value;
      }
    };

    volumeSlider.addEventListener("input", updateVolume);

    // кнопка "Продолжить"
    menu.querySelector("#btn-continue").addEventListener("click", () => {
      document.body.removeChild(overlay);
      this.togglePause(); // снимаем паузу
    });

    // кнопка "Рестарт"
    menu.querySelector("#btn-restart").addEventListener("click", () => {
      document.body.removeChild(overlay);
      this.restartCurrentLevel();
    });

    // кнопка "Выйти в меню"
    menu.querySelector("#btn-exit").addEventListener("click", () => {
      document.body.removeChild(overlay);
      this.returnToStartScreen();
    });

    // закрыть по Esc
    const escHandler = (e) => {
      if (e.key === "Escape") {
        document.body.removeChild(overlay);
        this.togglePause();
        document.removeEventListener("keydown", escHandler);
      }
    };
    document.addEventListener("keydown", escHandler);
  }

  restartCurrentLevel() {
    if (this.enemyInterval) {
      clearInterval(this.enemyInterval);
      this.enemyInterval = null;
    }

    // сбрасываем состояние уровня (вернуть в нач. сост.)
    this.enemies = [];
    this.swords = [];
    this.potions = [];
    this.boss = null;
    this.hero.health = this.CONST.HERO_MAX_HEALTH;

    // генерировать заново
    this.generateMap();
    this.renderMap();
    this.bindKeys();
    this.startEnemyMovement();

    // возобновляем музыку
    if (!this.isPaused) {
      this.playMusic("fight");
    }

    // снимаем паузу, если была
    if (this.isPaused) {
      this.togglePause();
    }
  }
  returnToStartScreen() {
    if (this.enemyInterval) {
      clearInterval(this.enemyInterval);
      this.enemyInterval = null;
    }
    this.stopMusic();

    // скрываем игровое поле, показываем стартовый экран
    const startScreen = document.getElementById("start-screen");
    if (startScreen) {
      startScreen.style.display = "flex";
    }

    // сброс игры
    this.currentLevel = 1;
    this.hero = {
      x: 0,
      y: 0,
      health: this.CONST.HERO_MAX_HEALTH,
      power: this.CONST.HERO_BASE_POWER,
    };
    this.inventory = Array(this.inventorySlots).fill(null);
    this.selectedInventoryIndex = 0;

    // обновление интерфейса
    if (this.field) this.field.innerHTML = "";
    if (this.inventoryEl) this.updateInventory();

    // снимаем паузу (на всякий)
    if (this.isPaused) {
      this.isPaused = false;
    }

    // переподключаем обработчик начала игры
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.type !== "click" && startScreen.style.display !== "none") {
          startScreen.style.display = "none";
          this.startGame();
        }
      },
      { once: true }
    );
  }

  // ============================================================================
  // =========================== ГЕНЕРАЦИЯ МИРА =================================
  // ============================================================================

  generateMap() {
    this.enemies = [];
    this.swords = [];
    this.potions = [];
    this.boss = null;

    this.map = Array(this.mapHeight)
      .fill()
      .map(() => Array(this.mapWidth).fill("W"));

    // вертикальные проходы (ТЗ!)
    const verticalPassages =
      Math.floor(
        Math.random() *
          (this.CONST.MAX_VERTICAL_PASSAGES -
            this.CONST.MIN_VERTICAL_PASSAGES +
            1)
      ) + this.CONST.MIN_VERTICAL_PASSAGES;
    for (let i = 0; i < verticalPassages; i++) {
      const x = Math.floor(Math.random() * this.mapWidth);
      for (let y = 0; y < this.mapHeight; y++) {
        this.map[y][x] = ".";
      }
    }

    // горизонтальные проходы (ТЗ!)
    const horizontalPassages =
      Math.floor(
        Math.random() *
          (this.CONST.MAX_HORIZONTAL_PASSAGES -
            this.CONST.MIN_HORIZONTAL_PASSAGES +
            1)
      ) + this.CONST.MIN_HORIZONTAL_PASSAGES;
    for (let i = 0; i < horizontalPassages; i++) {
      const y = Math.floor(Math.random() * this.mapHeight);
      for (let x = 0; x < this.mapWidth; x++) {
        this.map[y][x] = ".";
      }
    }

    // генерация комнат (5-10, ТЗ!)
    const roomCount =
      Math.floor(
        Math.random() * (this.CONST.MAX_ROOMS - this.CONST.MIN_ROOMS + 1)
      ) + this.CONST.MIN_ROOMS;
    const placedRoomsList = [];
    let placedRooms = 0;
    let attempts = 0;
    const maxAttempts = this.CONST.MAX_GEN_ATTEMPTS;

    const roomsIntersect = (room1, room2) => {
      return !(
        room1.x + room1.width <= room2.x ||
        room2.x + room2.width <= room1.x ||
        room1.y + room1.height <= room2.y ||
        room2.y + room2.height <= room1.y
      );
    };

    while (placedRooms < roomCount && attempts < maxAttempts) {
      attempts++;
      const width =
        Math.floor(
          Math.random() *
            (this.CONST.MAX_ROOM_WIDTH - this.CONST.MIN_ROOM_WIDTH + 1)
        ) + this.CONST.MIN_ROOM_WIDTH;
      const height =
        Math.floor(
          Math.random() *
            (this.CONST.MAX_ROOM_HEIGHT - this.CONST.MIN_ROOM_HEIGHT + 1)
        ) + this.CONST.MIN_ROOM_HEIGHT;
      const startX = Math.floor(Math.random() * (this.mapWidth - width));
      const startY = Math.floor(Math.random() * (this.mapHeight - height));

      if (
        startX < 0 ||
        startY < 0 ||
        startX + width >= this.mapWidth ||
        startY + height >= this.mapHeight
      ) {
        continue;
      }

      let intersects = false;
      for (const placedRoom of placedRoomsList) {
        if (
          roomsIntersect({ x: startX, y: startY, width, height }, placedRoom)
        ) {
          intersects = true;
          break;
        }
      }
      if (intersects) continue;

      let touchesPath = false;
      for (let dy = -1; dy <= height; dy++) {
        for (let dx = -1; dx <= width; dx++) {
          if (dx >= 0 && dx < width && dy >= 0 && dy < height) continue;
          const checkX = startX + dx;
          const checkY = startY + dy;
          if (
            checkX < 0 ||
            checkX >= this.mapWidth ||
            checkY < 0 ||
            checkY >= this.mapHeight
          )
            continue;
          if (this.map[checkY][checkX] === ".") {
            touchesPath = true;
            break;
          }
        }
        if (touchesPath) break;
      }

      if (!touchesPath) continue;

      for (let dy = 0; dy < height; dy++) {
        for (let dx = 0; dx < width; dx++) {
          this.map[startY + dy][startX + dx] = ".";
        }
      }
      placedRooms++;
      placedRoomsList.push({ x: startX, y: startY, width, height });
    }

    // УДАЛЕНИЕ ИЗОЛИРОВАННЫХ ОБЛАСТЕЙ (ТЗ)
    const reachable = this.getReachablePositions();
    const reachableSet = new Set(reachable.map((pos) => `${pos.x},${pos.y}`));
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        if (this.map[y][x] === "." && !reachableSet.has(`${x},${y}`)) {
          this.map[y][x] = "W";
        }
      }
    }

    this.placeItems();
    this.placeHero();
    this.placeEnemies();
  }

  placeItems() {
    for (let i = 0; i < this.CONST.SWORDS_COUNT; i++) {
      const pos = this.getRandomEmptyPosition();
      if (pos) {
        this.map[pos.y][pos.x] = "SW";
        this.swords.push({ x: pos.x, y: pos.y });
      }
    }

    for (let i = 0; i < this.CONST.POTIONS_COUNT; i++) {
      const pos = this.getRandomEmptyPosition();
      if (pos) {
        this.map[pos.y][pos.x] = "HP";
        this.potions.push({ x: pos.x, y: pos.y });
      }
    }
  }

  placeHero() {
    const pos = this.getRandomEmptyPosition();
    if (pos) {
      this.hero.x = pos.x;
      this.hero.y = pos.y;
      this.map[pos.y][pos.x] = "P";
    }
  }

  placeEnemies() {
    const enemyCount =
      this.currentLevel === 3
        ? this.CONST.ENEMIES_COUNT_LEVEL_3
        : this.CONST.ENEMIES_COUNT;
    const enemyHealth =
      this.currentLevel === 3
        ? this.CONST.ENEMY_HEALTH_LEVEL_3
        : this.CONST.ENEMY_HEALTH;

    for (let i = 0; i < enemyCount; i++) {
      const pos = this.getRandomEmptyPosition();
      if (pos) {
        this.enemies.push({ x: pos.x, y: pos.y, health: enemyHealth });
        this.map[pos.y][pos.x] = "E";
      }
    }

    // босс на третьем уровне
    if (this.currentLevel === 3) {
      const bossPos = this.getRandomEmptyPosition();
      if (bossPos) {
        this.boss = {
          x: bossPos.x,
          y: bossPos.y,
          health: this.CONST.BOSS_HEALTH,
          power: this.CONST.BOSS_BASE_DAMAGE,
          isBoss: true,
        };
        this.map[bossPos.y][bossPos.x] = "P";
      }
    }
  }

  getRandomEmptyPosition() {
    const emptyPositions = [];
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        if (this.map[y][x] === ".") {
          emptyPositions.push({ x, y });
        }
      }
    }
    return emptyPositions.length === 0
      ? null
      : emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
  }

  getReachablePositions() {
    const reachable = [];
    const visited = Array(this.mapHeight)
      .fill()
      .map(() => Array(this.mapWidth).fill(false));
    const queue = [];
    const startX = Math.floor(this.mapWidth / 2);
    const startY = Math.floor(this.mapHeight / 2);

    if (this.map[startY][startX] !== ".") {
      outer: for (let y = 0; y < this.mapHeight; y++) {
        for (let x = 0; x < this.mapWidth; x++) {
          if (this.map[y][x] === ".") {
            queue.push({ x, y });
            visited[y][x] = true;
            break outer;
          }
        }
      }
    } else {
      queue.push({ x: startX, y: startY });
      visited[startY][startX] = true;
    }

    const directions = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift();
      reachable.push(current);

      for (const dir of directions) {
        const newX = current.x + dir.dx;
        const newY = current.y + dir.dy;
        if (
          newX >= 0 &&
          newX < this.mapWidth &&
          newY >= 0 &&
          newY < this.mapHeight &&
          !visited[newY][newX] &&
          this.map[newY][newX] === "."
        ) {
          visited[newY][newX] = true;
          queue.push({ x: newX, y: newY });
        }
      }
    }

    return reachable;
  }

  // ============================================================================
  // =========================== ОТРИСОВКА ======================================
  // ============================================================================

  renderMap() {
    this.field.innerHTML = "";
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const tileType = this.map[y][x];
        const tile = document.createElement("div");
        tile.className = `tile tile${tileType}`;
        tile.style.left = `${x * this.tileSize}px`;
        tile.style.top = `${y * this.tileSize}px`;

        if (tileType === "E" || tileType === "P") {
          let entity;
          if (tileType === "P") {
            if (this.boss && this.boss.x === x && this.boss.y === y) {
              entity = this.boss;
            } else if (this.hero.x === x && this.hero.y === y) {
              entity = this.hero;
            }
          } else {
            entity = this.enemies.find((e) => e.x === x && e.y === y);
          }

          if (entity) {
            const healthBar = document.createElement("div");
            healthBar.className = entity.isBoss ? "boss-health" : "health";
            healthBar.style.width = `${entity.health}%`;
            tile.appendChild(healthBar);
          }
        }

        this.field.appendChild(tile);
      }
    }
  }

  // ============================================================================
  // =========================== УПРАВЛЕНИЕ =====================================
  // ============================================================================

  bindKeys() {
    document.removeEventListener("keydown", this.handleKeyPress);

    this.handleKeyPress = (e) => {
      const key = e.key.toLowerCase();

      switch (key) {
        case "w":
        case "ц":
          this.moveHero(this.hero.x, this.hero.y - 1);
          break;
        case "s":
        case "ы":
          this.moveHero(this.hero.x, this.hero.y + 1);
          break;
        case "a":
        case "ф":
          this.moveHero(this.hero.x - 1, this.hero.y);
          break;
        case "d":
        case "в":
          this.moveHero(this.hero.x + 1, this.hero.y);
          break;
        case " ":
          this.attack();
          return;
        case "e":
        case "у":
          this.useInventoryItem();
          return;
        case "t":
        case "е":
          this.showDeleteConfirmation();
          return;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
          this.selectInventorySlot(parseInt(key) - 1);
          return;
        case "arrowleft":
          this.selectInventorySlot(
            (this.selectedInventoryIndex - 1 + this.inventorySlots) %
              this.inventorySlots
          );
          return;
        case "arrowright":
          this.selectInventorySlot(
            (this.selectedInventoryIndex + 1) % this.inventorySlots
          );
          return;
      }

      this.checkItemCollision();
      this.enemyAttack();
      this.renderMap();
    };

    document.addEventListener("keydown", this.handleKeyPress);
  }
  // перемещает героя на указанную позицию, !ЕСЛИ! она проходима
  moveHero(x, y) {
    // проверка, находится ли новая позиция в пределах карты
    if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) {
      return; // Не позволять выйти за границы!
    }

    // проверка, является ли новая позиция проходимой
    if (
      this.map[y][x] !== "." &&
      this.map[y][x] !== "SW" &&
      this.map[y][x] !== "HP"
    ) {
      return; // НЕЛЬЗЯ ХОДИТЬ ЧЕРЕЗ СТЕНЫ И ВРАГОВ! ! !
    }

    this.map[this.hero.y][this.hero.x] = ".";
    this.hero.x = x;
    this.hero.y = y;
    this.map[y][x] = "P";
  }

  // ============================================================================
  // =========================== БОЙ И АТАКА ====================================
  // ============================================================================

  attack() {
    if (document.getElementById("victory-overlay")) return;

    this.highlightAttackArea();
    setTimeout(
      () => this.clearAttackHighlight(),
      this.CONST.ATTACK_HIGHLIGHT_DURATION
    );

    const directions = [
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
    ];

    for (const dir of directions) {
      const targetX = this.hero.x + dir.dx;
      const targetY = this.hero.y + dir.dy;

      // проверка, находится ли цель в пределах карты
      if (
        targetX < 0 ||
        targetX >= this.mapWidth ||
        targetY < 0 ||
        targetY >= this.mapHeight
      ) {
        continue;
      }

      // атака врагов
      const enemyIndex = this.enemies.findIndex(
        (e) => e.x === targetX && e.y === targetY
      );
      if (enemyIndex !== -1) {
        this.enemies[enemyIndex].health -= this.hero.power;
        if (this.enemies[enemyIndex].health <= 0) {
          this.map[targetY][targetX] = ".";
          this.enemies.splice(enemyIndex, 1);
        }
      }

      // атака босса
      if (
        this.currentLevel === 3 &&
        this.boss &&
        this.boss.x === targetX &&
        this.boss.y === targetY
      ) {
        this.boss.health -= this.hero.power;
        if (this.boss.health <= 0) {
          this.map[targetY][targetX] = ".";
          this.boss = null;
        }
      }
    }

    // проверка победы
    const allEnemiesDefeated =
      this.enemies.length === 0 &&
      (this.currentLevel !== 3 || this.boss === null);
    if (allEnemiesDefeated) {
      if (this.currentLevel === 1 || this.currentLevel === 2) {
        this.showVictoryMessage();
      } else if (this.currentLevel === 3) {
        this.showFinalVictory();
      }
    }
  }

  highlightAttackArea() {
    const directions = [
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
    ];

    for (const dir of directions) {
      const x = this.hero.x + dir.dx;
      const y = this.hero.y + dir.dy;
      if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) continue;

      const tile = this.getTileElement(x, y);
      if (tile) {
        const overlay = document.createElement("div");
        overlay.style.position = "absolute";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100%";
        overlay.style.height = "100%";
        overlay.style.backgroundColor = "rgba(255, 0, 0, 0.4)";
        overlay.style.zIndex = "1";
        overlay.className = "attack-overlay";
        tile.appendChild(overlay);
      }
    }
  }

  // удаляет подсветку атаки
  clearAttackHighlight() {
    document
      .querySelectorAll(".attack-overlay")
      .forEach((overlay) => overlay.remove());
  }
  // находит DOM-элемент тайла по его координатам
  getTileElement(x, y) {
    // querySelectorAll для поиска по стилям
    const tiles = document.querySelectorAll(".tile");
    const targetLeft = x * this.tileSize;
    const targetTop = y * this.tileSize;

    for (const tile of tiles) {
      const left = parseInt(tile.style.left);
      const top = parseInt(tile.style.top);
      if (left === targetLeft && top === targetTop) return tile;
    }
    return null;
  }
  // проверяет, находятся ли враги рядом с героем, и наносит урон герою
  enemyAttack() {
    // атака врагов
    for (const enemy of this.enemies) {
      const dx = Math.abs(enemy.x - this.hero.x);
      const dy = Math.abs(enemy.y - this.hero.y);
      if (dx <= 1 && dy <= 1 && dx + dy === 1) {
        this.hero.health -= this.CONST.ENEMY_BASE_DAMAGE;
        if (this.hero.health <= 0) {
          this.showGameOverScreen();
          return;
        }
      }
    }

    // атака босса
    if (this.currentLevel === 3 && this.boss) {
      const dx = Math.abs(this.boss.x - this.hero.x);
      const dy = Math.abs(this.boss.y - this.hero.y);
      if (dx <= 1 && dy <= 1 && dx + dy === 1) {
        this.hero.health -= this.CONST.BOSS_BASE_DAMAGE;
        if (this.hero.health <= 0) {
          this.showGameOverScreen();
          return;
        }
      }
    }
  }

  // ============================================================================
  // =========================== ПРЕДМЕТЫ И ИНВЕНТАРЬ ===========================
  // ============================================================================

  // метод для добавления в инвентарь
  addToInventory(itemType) {
    // поиск первого пустого слота
    for (let i = 0; i < this.inventorySlots; i++) {
      if (this.inventory[i] === null) {
        const newItem = { type: itemType };
        this.inventory[i] = newItem;

        // если это меч — усиливаем героя ОДИН РАЗ при подборе
        if (itemType === "sword") {
          this.hero.power += 5;
        }

        this.updateInventory();
        return true;
      }
    }
    return false; // инвентарь полон
  }

  // выбор слота инвентаря
  selectInventorySlot(index) {
    this.selectedInventoryIndex = index;
    this.updateInventory();
  }

  useInventoryItem() {
    const item = this.inventory[this.selectedInventoryIndex];
    if (!item) return;

    if (item.type === "potion" && this.hero.health < 100) {
      this.hero.health = Math.min(
        this.CONST.HERO_MAX_HEALTH,
        this.hero.health + this.CONST.HERO_POTION_HEAL
      );
      this.inventory[this.selectedInventoryIndex] = null;
      this.updateInventory();
      this.showItemEffect("heal");
    }
    // мечи нельзя "использовать" — они уже усилили героя при подборе
  }

  selectInventorySlot(index) {
    this.selectedInventoryIndex = index;
    this.updateInventory();
  }

  showDeleteConfirmation() {
    const item = this.inventory[this.selectedInventoryIndex];
    if (!item) return;

    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.9);
      padding: 20px;
      border: 2px solid red;
      border-radius: 10px;
      z-index: 1000;
      color: white;
      text-align: center;
      font-family: Arial, sans-serif;
    `;

    overlay.innerHTML = `
      <p>Вы уверены, что хотите выбросить предмет?</p>
      <p>Он пропадет безвозвратно!</p>
      <div style="margin-top: 15px;">
        <button id="confirm-delete-yes" style="margin-right: 10px; padding: 8px 20px; background: #ff3333; color: white; border: none; border-radius: 4px; cursor: pointer;">Да</button>
        <button id="confirm-delete-no" style="padding: 8px 20px; background: #555; color: white; border: none; border-radius: 4px; cursor: pointer;">Нет</button>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById("confirm-delete-yes").onclick = () => {
      this.inventory[this.selectedInventoryIndex] = null;
      this.updateInventory();
      document.body.removeChild(overlay);
    };

    document.getElementById("confirm-delete-no").onclick = () => {
      document.body.removeChild(overlay);
    };

    // закрыть по Esc
    const escHandler = (e) => {
      if (e.key === "Escape") {
        document.body.removeChild(overlay);
        document.removeEventListener("keydown", escHandler);
      }
    };
    document.addEventListener("keydown", escHandler);
  }

  checkItemCollision() {
    // мечи
    const swordIndex = this.swords.findIndex(
      (s) => s.x === this.hero.x && s.y === this.hero.y
    );
    if (swordIndex !== -1) {
      this.playMusic("pickup");
      if (!this.addToInventory("sword")) {
        // инвентарь полон — просто игнорируем
      }
      this.map[this.hero.y][this.hero.x] = "P";
      this.swords.splice(swordIndex, 1);
    }

    // зелья
    const potionIndex = this.potions.findIndex(
      (p) => p.x === this.hero.x && p.y === this.hero.y
    );
    if (potionIndex !== -1) {
      this.playMusic("pickup");
      if (this.hero.health >= 100) {
        // полное здоровье — кладем в инвентарь
        if (!this.addToInventory("potion")) {
          // инвентарь полон — используем сразу
          this.hero.health = Math.min(
            this.CONST.HERO_MAX_HEALTH,
            this.hero.health + this.CONST.HERO_POTION_HEAL
          );
          this.showItemEffect("heal");
        }
      } else {
        // не полное — используем сразу
        this.hero.health = Math.min(
          this.CONST.HERO_MAX_HEALTH,
          this.hero.health + this.CONST.HERO_POTION_HEAL
        );
        this.showItemEffect("heal");
      }
      this.map[this.hero.y][this.hero.x] = "P";
      this.potions.splice(potionIndex, 1);
    }
  }

  // показывает визуальный эффект при использовании предмета (подсветка)
  showItemEffect(type) {
    this.renderMap();
    setTimeout(() => {
      const heroTile = this.getTileElement(this.hero.x, this.hero.y);
      if (heroTile) {
        const overlay = document.createElement("div");
        overlay.style.position = "absolute";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100%";
        overlay.style.height = "100%";
        overlay.style.zIndex = "10";
        overlay.className = `${type}-overlay`;

        if (type === "sword") {
          overlay.style.backgroundColor = "rgba(0, 100, 255, 0.4)";
        } else {
          overlay.style.backgroundColor = "rgba(0, 255, 0, 0.4)";
        }

        heroTile.appendChild(overlay);
        setTimeout(() => overlay.remove(), this.CONST.ITEM_EFFECT_DURATION);
      }
    }, 10);
  }

  //  Обновляет отображение инвентаря на экране. РАЗМЕЩАТЬ В КОНЦЕ!
  updateInventory() {
    if (!this.inventoryEl) return;
    this.inventoryEl.innerHTML = "";

    const slotWidth = this.tileSize * 2;
    const containerWidth = this.inventoryEl.offsetWidth; // <- автоматически!
    const leftOffset = (containerWidth - slotWidth) / 2;

    for (let i = 0; i < this.inventorySlots; i++) {
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.style.position = "absolute";
      slot.style.left = leftOffset + "px";
      slot.style.top = i * slotWidth + "px";
      slot.style.width = slotWidth + "px";
      slot.style.height = slotWidth + "px";
      slot.style.background = "transparent";
      slot.style.border = "1px solid #444";

      if (i === this.selectedInventoryIndex) {
        slot.style.border = "2px solid green";
        slot.style.boxShadow = "0 0 8px rgba(0, 255, 0, 0.6)";
      }

      if (this.inventory[i]) {
        slot.style.border = "none";

        const item = this.inventory[i];
        const itemSprite = document.createElement("div");
        itemSprite.style.cssText = `
        position: absolute;
        width: 100%;
        height: 100%;
        top: 0;
        left: 0;
        z-index: 2;
        background-size: 80%;
        background-position: center;
        background-repeat: no-repeat;
        background-color: transparent;
      `;
        itemSprite.className =
          "tile " + (item.type === "sword" ? "tileSW" : "tileHP");

        slot.appendChild(itemSprite);
      }

      this.inventoryEl.appendChild(slot);
    }
  }
  // ============================================================================
  // =========================== ДВИЖЕНИЕ ВРАГОВ ================================
  // ============================================================================
  // запускает интервал для периодического движения врагов и босса (1с)
  startEnemyMovement() {
    this.enemyInterval = setInterval(() => {
      if (document.getElementById("victory-overlay")) {
        clearInterval(this.enemyInterval);
        return;
      }

      // движение врагов
      for (let i = 0; i < this.enemies.length; i++) {
        const enemy = this.enemies[i];
        const directions = [
          { dx: -1, dy: 0 },
          { dx: 1, dy: 0 },
          { dx: 0, dy: -1 },
          { dx: 0, dy: 1 },
        ];
        const dir = directions[Math.floor(Math.random() * 4)];
        const newX = enemy.x + dir.dx;
        const newY = enemy.y + dir.dy;

        if (
          newX >= 0 &&
          newX < this.mapWidth &&
          newY >= 0 &&
          newY < this.mapHeight &&
          this.map[newY][newX] === "." &&
          !(newX === this.hero.x && newY === this.hero.y)
        ) {
          this.map[enemy.y][enemy.x] = ".";
          enemy.x = newX;
          enemy.y = newY;
          this.map[newY][newX] = "E";
        }
      }

      // движение босса
      if (this.currentLevel === 3 && this.boss) {
        const directions = [
          { dx: -1, dy: 0 },
          { dx: 1, dy: 0 },
          { dx: 0, dy: -1 },
          { dx: 0, dy: 1 },
        ];
        const dir = directions[Math.floor(Math.random() * 4)];
        const newX = this.boss.x + dir.dx;
        const newY = this.boss.y + dir.dy;

        if (
          newX >= 0 &&
          newX < this.mapWidth &&
          newY >= 0 &&
          newY < this.mapHeight &&
          this.map[newY][newX] === "." &&
          !(newX === this.hero.x && newY === this.hero.y)
        ) {
          this.map[this.boss.y][this.boss.x] = ".";
          this.boss.x = newX;
          this.boss.y = newY;
          this.map[newY][newX] = "P";
        }
      }

      this.enemyAttack();
      this.renderMap();
    }, this.CONST.ENEMY_MOVE_INTERVAL);
  }

  // ============================================================================
  // =========================== ПЕРЕХОД УРОВНЕЙ ================================
  // ============================================================================
  // запускаем след. уровень
  startNextLevel() {
    if (this.enemyInterval) {
      clearInterval(this.enemyInterval);
      this.enemyInterval = null;
    }

    this.currentLevel++;
    this.stopMusic();

    if (this.currentLevel > 3) {
      this.showFinalVictory();
      return;
    }

    this.enemies = [];
    this.swords = [];
    this.potions = [];

    this.generateMap();
    this.renderMap();
    this.bindKeys();
    this.startEnemyMovement();
    this.playMusic("fight");
  }
}
// создание и инициализация игры
var game = new Game();
game.init();
