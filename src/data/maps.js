// src/data/maps.ts
const BASE_URL = import.meta.env.BASE_URL;
export const maps = [
    // EP1
    // { episode: 1, level: 1, name: '夏奧雷伊西邊森林', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, enName: 'West Siauliai Woods' },
    // { episode: 1, level: 3, name: '夏奧雷伊東邊森林', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, enName: 'East Siauliai Woods' },
    // { episode: 1, level: 5, name: '蓮帕拉沙池塘', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, enName: 'Lemprasa Pond' },
    { episode: 1, level: 7, name: '夏奧雷伊礦山村莊', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/夏奧雷伊礦山村莊.webp`, enName: 'Miners\' Village' },
    { episode: 1, level: 9, name: '水晶礦山', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/水晶礦山.webp`, enName: 'Crystal Mine' },
    // EP2
    // { episode: 2, level: 10, name: '斯拉屋塔斯峽谷', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, enName: 'Srautas Gorge' },
    // { episode: 2, level: 11, name: '凱利高原', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, enName: 'Gele Plateau' },
    { episode: 2, level: 12, name: '奈普里塔斯懸崖', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/奈普里塔斯懸崖.webp`, enName: 'Nefritas Cliff' },
    { episode: 2, level: 13, name: '泰內花園', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/泰內花園.webp`, enName: 'Tenet Garden' },
    { episode: 2, level: 15, name: '泰內聖堂地下1層', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/泰內聖堂地下1層.webp`, enName: 'Tenet Church B1' },
    { episode: 2, level: 17, name: '泰內聖堂地上1層', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/泰內聖堂地上1層.webp`, enName: 'Tenet Church 1F' },
    { episode: 2, level: 19, name: '泰內聖堂地上2層', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/泰內聖堂地上2層.webp`, enName: 'Tenet Church 2F' },
    // EP3
    // { episode: 3, level: 20, name: '庫魯森林', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, enName: 'Koru Jungle' },
    // { episode: 3, level: 21, name: '克尼多斯森林', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, enName: 'Knidos Jungle' },
    { episode: 3, level: 22, name: '達旦森林', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/達旦森林.webp`, enName: 'Dadan Jungle' },
    { episode: 3, level: 24, name: '諾巴哈公會所', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/諾巴哈公會所.webp`, enName: 'Novaha Assembly Hall' },
    { episode: 3, level: 26, name: '諾巴哈別館', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/諾巴哈別館.webp`, enName: 'Novaha Annex' },
    { episode: 3, level: 28, name: '諾巴哈本院', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/諾巴哈本院.webp`, enName: 'Novaha Institute' },
    // EP4
    // { episode: 4, level: 30, name: '貝雅山谷', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, enName: 'Veja Ravine' },
    // { episode: 4, level: 31, name: '比爾塔溪谷', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, enName: 'Vieta Gorge' },
    { episode: 4, level: 32, name: '科博爾特森林', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/科博爾特森林.webp`, enName: 'Cobalt Forest' },
    { episode: 4, level: 34, name: '賽堤尼山溝', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/賽堤尼山溝.webp`, enName: 'Septyni Glen' },
    { episode: 4, level: 36, name: '培爾克神殿', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/培爾克神殿.webp`, enName: 'Pelke Shrine Ruins' },
    { episode: 4, level: 38, name: '安森塔水源地', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/安森塔水源地.webp`, enName: 'Absenta Reservoir' },
    // EP5
    // { episode: 5, level: 40, name: '卡羅利斯泉水', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, enName: 'Karolis Springs' },
    // { episode: 5, level: 42, name: '萊塔斯小溪', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, enName: 'Letas Stream' },
    { episode: 5, level: 44, name: '德慕爾佃農村', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/德慕爾佃農村.webp`, enName: 'Delmore Hamlet' },
    { episode: 5, level: 46, name: '德慕爾莊園', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/德慕爾莊園.webp`, enName: 'Delmore Manor' },
    { episode: 5, level: 48, name: '德慕爾外城', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/德慕爾外城.webp`, enName: 'Delmore Outskirts' },
    // EP6
    // { episode: 6, level: 50, name: '達伊納養蜂地', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, enName: 'Dina Bee Farm' },
    // { episode: 6, level: 51, name: '比爾那森林', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, enName: 'Vilna Forest' },
    { episode: 6, level: 52, name: '烏奇斯耕作地', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/烏奇斯耕作地.webp`, enName: 'Uskis Arable Land' },
    { episode: 6, level: 53, name: '春光樹林', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/春光樹林.webp`, enName: 'Spring Light Woods' },
    { episode: 6, level: 55, name: '關口路', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/關口路.webp`, enName: 'Gate Route' },
    { episode: 6, level: 57, name: '史爾特凱拉森林', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/史爾特凱拉森林.webp`, enName: 'Sirdgela Forest' },
    { episode: 6, level: 59, name: '克巴伊拉斯森林', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/克巴伊拉斯森林.webp`, enName: 'Kvailas Forest' },
    // EP7
    // { episode: 7, level: 60, name: '魯卡斯高原', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, enName: 'Rukas Plateau' },
    // { episode: 7, level: 61, name: '王之高原', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, enName: 'King\'s Plateau' },
    { episode: 7, level: 62, name: '扎卡里耶爾交叉路', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/扎卡里耶爾交叉路.webp`, enName: 'Zachariel Crossroads' },
    { episode: 7, level: 64, name: '王陵1層', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/王陵1層.webp`, enName: 'Royal Mausoleum 1F' },
    { episode: 7, level: 66, name: '王陵2層', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/王陵2層.webp`, enName: 'Royal Mausoleum 2F' },
    { episode: 7, level: 68, name: '王陵3層', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/王陵3層.webp`, enName: 'Royal Mausoleum 3F' },
    // EP8
    { episode: 8, level: 70, name: '水路橋地區', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/水路橋地區.webp`, enName: 'Aqueduct Bridge Area' },
    { episode: 8, level: 70, name: '阿雷魯諾男爵領', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/阿雷魯諾男爵領.webp`, enName: 'Baron Allerno' },
    { episode: 8, level: 71, name: '魔族收監所第1區', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/魔族收監所第1區.webp`, enName: 'Demon Prison District 1' },
    { episode: 8, level: 72, name: '魔族收監所第3區', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/魔族收監所第3區.webp`, enName: 'Demon Prison District 3' },
    { episode: 8, level: 73, name: '魔族收監所第4區', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/魔族收監所第4區.webp`, enName: 'Demon Prison District 4' },
    { episode: 8, level: 74, name: '魔族收監所第5區', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/魔族收監所第5區.webp`, enName: 'Demon Prison District 5' },
    // EP9
    { episode: 9, level: 75, name: '女神的古院', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/女神的古院.webp`, enName: 'Goddess\' Ancient Garden' },
    { episode: 9, level: 76, name: '佩迪米安外城', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/佩迪米安外城.webp`, enName: 'Fedimian Suburbs' },
    { episode: 9, level: 77, name: '魔法師之塔一層', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/魔法師之塔一層.webp`, enName: 'Mage Tower 1F' },
    { episode: 9, level: 78, name: '魔法師之塔二層', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/魔法師之塔二層.webp`, enName: 'Mage Tower 2F' },
    { episode: 9, level: 79, name: '魔法師之塔三層', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/魔法師之塔三層.webp`, enName: 'Mage Tower 3F' },
    // EP10
    { episode: 10, level: 80, name: '大教堂懺悔路', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/大教堂懺悔路.webp`, enName: 'Penitence Route' },
    { episode: 10, level: 81, name: '大教堂正殿', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/大教堂正殿.webp`, enName: 'Main Building' },
    { episode: 10, level: 82, name: '大教堂大迴廊', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/大教堂大迴廊.webp`, enName: 'Grand Corridor' },
    { episode: 10, level: 83, name: '大教堂至聖所', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/大教堂至聖所.webp`, enName: 'Sanctuary' },
    // EP11
    { episode: 11, level: 85, name: '拉烏基美濕地', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/拉烏基美濕地.webp`, enName: 'Laukyme Swamp' },
    { episode: 11, level: 86, name: '堤拉修道院', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/堤拉修道院.webp`, enName: 'Tyla Monastery' },
    { episode: 11, level: 87, name: '貝拉伊森林', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/貝拉伊森林.webp`, enName: 'Bellai Rainforest' },
    { episode: 11, level: 88, name: '潔拉哈', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/潔拉哈.webp`, enName: 'Zeraha' },
    { episode: 11, level: 89, name: '世伊魯森林', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/世伊魯森林.webp`, enName: 'Seir Rainforest' },
    // EP12
    { episode: 12, level: 90, name: '沿岸要塞', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/沿岸要塞.webp`, enName: 'Coastal Fortress' },
    { episode: 12, level: 91, name: '丁格巴希地區', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/丁格巴希地區.webp`, enName: 'Dingofasil District' },
    { episode: 12, level: 92, name: '大地要塞貯藏區域', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/大地要塞貯藏區域.webp`, enName: 'Storage Quarter' },
    { episode: 12, level: 93, name: '大地要塞決戰地', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/大地要塞決戰地.webp`, enName: 'Fortress Battlegrounds' },
    // EP13
    { episode: 13, level: 95, name: '阿勒篾森林', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/XXXXXX.webp`, enName: 'Alemeth Forest' },
    { episode: 13, level: 98, name: '巴勒哈森林', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/XXXXXX.webp`, enName: 'Barha Forest' },
    { episode: 13, level: 101, name: '卡雷伊瑪斯接見所', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/XXXXXX.webp`, enName: 'Kalejimas Visiting Room' },
    { episode: 13, level: 103, name: '卡雷伊瑪斯拷問所', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/XXXXXX.webp`, enName: 'Investigation Room' },
    // EP14
    { episode: 14, level: 105, name: '娜圖森林', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/XXXXXX.webp`, enName: 'Nheto Forest' },
    { episode: 14, level: 107, name: '史巴賓嘉斯森林', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/XXXXXX.webp`, enName: 'Svalphinghas Forest' },
    { episode: 14, level: 109, name: '娜塔勒森林', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/XXXXXX.webp`, enName: 'Lhadar Forest' },
    { episode: 14, level: 111, name: '泰芙林鐘乳洞1區域', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/XXXXXX.webp`, enName: 'Tevhrin Stalactite Cave Section 1' },
    { episode: 14, level: 113, name: '泰芙林鐘乳洞2區域', maxStages: 4, isStarred: false, respawnTime: 25 * 60 + 15, imagePath: `${BASE_URL}maps/XXXXXX.webp`, enName: 'Tevhrin Stalactite Cave Section 2' }
];
