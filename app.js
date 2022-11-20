// api
const API = 'https://api.p2pquake.net/v2/history?codes=551&limit=100';
// 地震データ格納先
let earthquakeData = {};
// 最新情報のID
let resultID = '';
// カラースケール
let f = chroma
    .scale(['#7bff00', '#ffea00', '#ff1500', '#fe00ed'])
    .domain([0, 9]);

map = new maplibregl.Map({
    container: 'map',
    style: {
        version: 8,
        sources: {
            'raster-tiles': {
                type: 'raster',
                tiles: [
                    'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
                ],
                tileSize: 256,
                attribution:
                    "地図の出典：<a href='https://www.gsi.go.jp/' target='_blank'>国土地理院</a>",
            },
            v: {
                type: 'vector',
                tiles: [
                    'https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/{z}/{x}/{y}.pbf',
                ],
                minzoom: 0,
                maxzoom: 24,
            },
            jpn: {
                type: 'geojson',
                data: './todouhuken.geojson',
            },
        },

        layers: [
            {
                id: 'simple-tiles',
                type: 'raster',
                source: 'raster-tiles',
                minzoom: 0,
                maxzoom: 24,
                paint: {
                    'raster-brightness-max': 1,
                    'raster-brightness-min': 0,
                },
            },
            {
                id: 'hazama',
                type: 'background',
                paint: {
                    'background-color': '#000000',
                    'background-opacity': 0.5,
                },
            },
            {
                id: 'jpn',
                type: 'fill',
                source: 'jpn',
                filter: ['all', ['match', ['get', 'name'], '', true, false]],

                layout: {},
                paint: {
                    'fill-color': '#fd1874',
                    'fill-opacity': 0.6,
                },
            },
            {
                id: 'AdmArea',
                maxzoom: 8,
                type: 'line',
                source: 'v',
                'source-layer': 'AdmArea',

                layout: {},
                paint: {
                    'line-color': '#ffffff',
                    'line-width': 2,
                    'line-blur': 1,
                },
            },
            {
                id: 'AdmBdry',
                type: 'line',
                source: 'v',
                'source-layer': 'AdmBdry',

                layout: {},
                paint: {
                    'line-color': '#ffffff',
                    'line-width': 2,
                    'line-blur': 1,
                },
            },
        ],
    },
    center: [137.8894, 39.0613],
    zoom: 4,
    pitch: 60,
    customAttribution:
        "データ出典：<a href='https://www.p2pquake.net/' target='_blank'>P2P地震情報</a>・<a href='https://www.jma.go.jp/jma/index.html' target='_blank'>気象庁HP</a>",
});

map.on('load', () => {
    const square = turf.bbox(
        turf.buffer(turf.point([137.8894, 39.0613]), 1, {
            units: 'miles',
        }),
    );
    map.addSource('canvas-source', {
        type: 'canvas',
        canvas: 'myCanvas',
        coordinates: [
            [square[0], square[3]],
            [square[2], square[3]],
            [square[2], square[1]],
            [square[0], square[1]],
        ],
        animate: true,
    });
    map.addLayer({
        id: 'canvas-layer',
        type: 'raster',
        source: 'canvas-source',
    });
    callApi();
});

async function callApi() {
    try {
        const response = await window.fetch(API);
        const list = await response.json();
        //座標がおかしいものは排除
        let listfix = list.filter(function (data) {
            return (
                data.earthquake.hypocenter.latitude !== -200 &&
                data.points.length > 0
            );
        });

        earthquakeData = listfix;
        resultID = listfix[0].id;
        buttonFactory(listfix);
        Jump(resultID);
        polling();
    } catch (error) {
        console.error(error);
    }
}

// ボタンの生成
function buttonFactory(listfix) {
    listfix.map((data) => {
        const buttonlist = document.getElementById('buttonlist');
        const button = document.createElement('button');
        button.className = 'none';
        button.setAttribute('onclick', 'Jump(this.value, this.className)');
        button.value = data.id;
        button.id = data.id;
        const name = document.createElement('p');
        name.innerText = `M${data.earthquake.hypocenter.magnitude} ${data.earthquake.hypocenter.name}`;
        name.className = 'name';
        const time = document.createElement('p');
        time.innerText = data.earthquake.time;
        time.className = 'time';

        button.appendChild(time);
        button.appendChild(name);
        buttonlist.appendChild(button);
    });
}

// 対象キャンバス
const canvas = document.getElementById('myCanvas');
// 開始時間
let startTime = Date.now();
// 動かしたやつの最大値
let endValue = 240;
//イージング
const easeOutSine = (x) => {
    return Math.sin((x * Math.PI) / 2);
};

// ボタンクリックイベント
function Jump(params) {
    const ulElement = document.getElementById('buttonlist');
    const children = ulElement.children;
    Array.prototype.forEach.call(children, function (item) {
        item.className = 'none';
    });
    const toggle = document.getElementById(params);
    toggle.classList.toggle('active');

    const selectData = earthquakeData.filter((x) => x.id === params);

    const boxElement = document.querySelector('button.active');
    boxElement.style.setProperty(
        '--color',
        f(selectData[0].earthquake.hypocenter.magnitude),
    );

    const status = document.getElementById('status');
    status.innerHTML = '';

    selectData[0].points.map((data) => {
        const text = document.createElement('p');
        text.innerText = `震度${data.scale / 10} ${data.pref + data.addr}`;
        text.className = 'statusText';
        text.style.borderBottom = `5px solid ${f(data.scale / 10)}`;
        status.appendChild(text);
    });

    // データから関連する都道府県を表示
    const filter = selectData[0].points.map((data) => {
        return data.pref;
    });
    const arr = new Set(filter);
    map.setFilter('jpn', ['in', 'name', ...arr]);

    // canvasレイヤーの設置
    const square = turf.bbox(
        turf.buffer(
            turf.point([
                selectData[0].earthquake.hypocenter.longitude,
                selectData[0].earthquake.hypocenter.latitude,
            ]),
            selectData[0].earthquake.hypocenter.magnitude * 50,
            {
                units: 'miles',
            },
        ),
    );
    const mySource = map.getSource('canvas-source');
    mySource.setCoordinates([
        [square[0], square[3]],
        [square[2], square[3]],
        [square[2], square[1]],
        [square[0], square[1]],
    ]);

    // カメラを移動
    map.fitBounds(
        [
            [square[0], square[1]],
            [square[2], square[3]],
        ],
        {
            padding: 100,
        },
    );
    // アニメーション
    const anime = () => {
        // 描画リセット
        canvas.width = canvas.width;
        // 増やす
        mainProgress = Math.min(1, (Date.now() - startTime) / 1000);
        subProgres = Math.min(1, (Date.now() - startTime) / 100);
        // 動かす量
        let moveValue = endValue * easeOutSine(mainProgress);

        //円
        const ctxCircle = canvas.getContext('2d');
        ctxCircle.strokeStyle = f(
            selectData[0].earthquake.hypocenter.magnitude,
        );
        ctxCircle.lineWidth = 5;
        ctxCircle.beginPath();
        ctxCircle.arc(250, 250, moveValue, 0, 2 * Math.PI);
        ctxCircle.globalAlpha = subProgres;
        ctxCircle.closePath();
        ctxCircle.stroke();

        // 中心
        const center = canvas.getContext('2d');
        center.beginPath();
        center.lineWidth = 6;
        center.lineCap = 'round';
        center.moveTo(240, 240);
        center.lineTo(260, 260);
        center.stroke();
        center.moveTo(240, 260);
        center.lineTo(260, 240);
        center.stroke();

        if (mainProgress < 1) {
            requestAnimationFrame(anime);
        }
    };
    startTime = Date.now();
    requestAnimationFrame(anime);
}

// 新着情報を監視
const polling = () => {
    setTimeout(async () => {
        const response = await fetch(API);
        const list = await response.json();
        //座標がおかしいものは排除
        let listfix = list.filter((data) => {
            return (
                data.earthquake.hypocenter.latitude !== -200 &&
                data.points.length > 0
            );
        });

        // 新しい情報があればボタンを再セット
        if (resultID !== listfix[0].id) {
            earthquakeData = listfix;
            resultID = listfix[0].id;
            buttonlist.innerHTML = '';
            buttonFactory(listfix);
            Jump(resultID);
        }

        polling(); // 再帰呼び出し
    }, 10000);
};
