# BOBO 2D 音频署名与许可

2026-10-01用户提供8份桌面音频已替换对应槽位，具体文件/处理在audio_sources/user_supplied_20261001/SOURCE.md；原作者/物种/许可待补，不继承下方旧音频署名。下方旧资源仍保留，但其许可不能用于用户新音频。公开分发前必须核实用户音频许可。

随源码和游戏分发保留本文件。素材许可不适用于BOBO代码/插画；不暗示作者或机构为项目背书。

## 完整介绍的人声朗读（20种动物，2026-10-02）

`art/audio/narration/*_full_v1.ogg` 为BOBO完整介绍的合成普通话人声，不是动物叫声，也不是真人录音。
模型：hexgrad / Kokoro-82M-v1.1-zh，Apache-2.0。
https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh
推理：k2-fsa / sherpa-onnx 1.13.8，Apache-2.0；离线使用 zf_001（sid 3），speed 0.94。
https://github.com/k2-fsa/sherpa-onnx
原模型、完整许可、原始PCM、文案SHA256及处理记录保留在源码 `audio_sources/narration_tts_v1/`，不将模型或生成工具打入游戏。
处理：24kHz单声道，BS.1770两遍平均响度归一化目标-18LUFS、真峰值余量-2dB，OGG Vorbis；玩家音量-3dB。
完整介绍来自用户迁移内容表的解说词整理，科普修订依据见 `data/animal_narration.json`；不是只读画面短句。
随运行版附 Apache-2.0 完整文本 `NARRATION_LICENSE.txt`。该模型许可不代表其他用户提供的动物叫声已获授权。

## 狮子

Lion loud.mp3 — Bidone. Freesound 69570, 2009-03-23.
https://freesound.org/people/Bidone/sounds/69570/
CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/
使用公开HQ预览编码，截取11.5–13.2秒、单声道、音量和首尾淡化。不变调。

## 长颈鹿（进食，不是叫声）

Girafe-En train de manger+amb oiseaux.aif — G de Courtivron / roubignolle.
https://freesound.org/people/roubignolle/sounds/35143/
CC BY 4.0: https://creativecommons.org/licenses/by/4.0/
坦桑尼亚进食，含背景鸟声。公开HQ预览编码截取10–12.3秒、单声道、音量和首尾淡化。

## 棕熊

Karhut murisevat / A couple of bears growling, brown bear — YleArkisto / Finnish Broadcasting Company.
https://freesound.org/people/YleArkisto/sounds/249441/
CC BY 4.0: https://creativecommons.org/licenses/by/4.0/
1975-05-06，芬兰Ähtäri动物园。公开HQ预览编码截取0.5–3秒、单声道、音量和首尾淡化。

## 红狐狸

Red Fox — NPS / Shan Burson, 2008-03-07.
https://www.nps.gov/yell/learn/photosmultimedia/sounds-redfox.htm
截取0–2.8秒、单声道、音量和首尾淡化。

## 白头海雕

Bald Eagle, Yellowstone National Park — NPS.
https://www.nps.gov/subjects/sound/sounds-bald-eagle.htm
2.5077秒全段、单声道、音量和首尾淡化；背景含渡鸦。

以上NPS署名的美国政府作品按公共领域处理；政策：https://www.nps.gov/aboutus/disclaimer.htm
No claim to original U.S. Government works. 不使用机构徽标。

## 宽吻海豚

Courtesy: National Oceanic and Atmospheric Administration.
NOAA Fisheries, Northeast Fisheries Science Center, Passive Acoustics Branch. 2023. Bottlenose Dolphin (Tursiops truncatus).
https://www.fisheries.noaa.gov/national/science-data/sounds-ocean-mammals
Tutr-multisound-NOAA-PAGroup-03-bottlenose-dolphin-clip.mp3，截取0–3秒、单声道、音量和首尾淡化。
美国政府作品，公共领域（美国）。不声明对原始美国政府作品拥有版权。
政策：https://www.fisheries.noaa.gov/national/about-us/website-policies-and-disclaimers
逐项署名表：https://www.fisheries.noaa.gov/s3/2023-06/SoundsPageCitations-2023-0.pdf （第12页，非照片署名）

## 替换素材

## 2026-10-01新增接入（听感仍待验收）

- 极地页面海岸风补位：Tom_Kaszuba，Wind at Ocean shore.，https://freesound.org/people/Tom_Kaszuba/sounds/659004/ ，CC0-1.0。公开HQ MP3 5–8秒，mono、淡化、播放器响度校准；不是动物叫声，不宣称极地现场。替换北极熊/企鹅/海豹先前水下补位。

- 非洲象：King L, Soltis J, Douglas-Hamilton I, Savage A, Vollrath F，PLOS ONE Audio S1，https://commons.wikimedia.org/wiki/File:Bee-Threat-Elicits-Alarm-Call-in-African-Elephants-pone.0010346.s001.ogg ，CC BY 2.5 https://creativecommons.org/licenses/by/2.5/ 。0–3秒蜂刺激真实低鸣，monoPCM16、淡化、降3dB；不是号叫，没有变调。
- 大熊猫：Mizunoryu，https://commons.wikimedia.org/wiki/File:Giant_panda_twittering.ogg ，PD-self公共领域。0–3秒发声，非咀嚼；mono、淡化及增益+0.2dB。
- 红眼树蛙：Klemens Bottig，https://commons.wikimedia.org/wiki/File:Rotaugenlaubfrosch_Paarungsruf.ogg ，Copyrighted free use（文件页允许任何用途）。0–3秒求偶声、mono、淡化、+18.1dB；原作者身份回源未独立验证。
- 梅花鹿：Lawrence Shove / The British Library Board，https://commons.wikimedia.org/wiki/File:Sika_Deer_(Cervus_nippon)_(W1CDR0001426_BD2).ogg ，CC BY-SA 4.0 https://creativecommons.org/licenses/by-sa/4.0/ 。0–3秒mono、淡化、+15.7dB。独立衍生音轨sika_deer_real_v1/v2.wav沿用CC BY-SA 4.0，不将该许可扩展给代码或插画。
- 大红鹳：Olaf Oliviero Riemer (Fiorellino)，https://commons.wikimedia.org/wiki/File:Phoenicopterus_roseus_(Rosaflamingo_-_Greater_Flamingo)_%E2%80%94_Weltvogelpark_Walsrode_2013.ogg ，CC BY-SA 3.0 https://creativecommons.org/licenses/by-sa/3.0/ 。0–3秒mono、淡化、+4.5dB；独立衍生音轨greater_flamingo_real_v1/v2.wav沿用同许可。
- 林间环境补位：deleted_user_229898，wind in the trees，https://freesound.org/people/deleted_user_229898/sounds/150174/ ，CC0-1.0。公开HQ MP3预览10–13秒，mono、淡化、+19.2dB。含风/背景鸟声，不是动物叫声，不宣称物种当地录音。
- 海洋环境补位：Felix Blume，https://freesound.org/people/felix.blume/sounds/705058/ ，CC0-1.0。秘鲁Ilo港水下海浪公开HQ MP3预览2–5秒，mono、淡化、+10.7dB；不是极地录音，不是海龟/章鱼等叫声。

旧长颈鹿/棕熊/狐狸/海豚v2增益分别+3.1/+3.9/+4.6/+5dB、播放器-3dB；海雕播放器-5.9dB；狮子不变。原文件与旧版保留，许可不变。所有新增片段尚需真实听感、背景干扰与动作时机验收。

audio_overrides中的用户文件不自动继承以上来源和许可。正式采用前逐项补齐记录；未核验的不标成已授权。

## 用户背景音乐 · 2026-10-03（用户确认接入并授权网页发布）

- Animal Family，用户提供的 `Animal Family BGM.mp3`；文件元数据作者 wangshengchen666、made with suno、生成ID `1fc403ae-6eaf-42a3-90ad-a4aeff7209ce`。账户套餐与商业分发权限未核实，不宣称CC0或第三方授权已核验。
- 原件留在 `audio_sources/background_music/user_suno_v1/Animal_Family_original.mp3`，处理版本 `audio_overrides/background_music_v1.ogg`：立体声44.1kHz、Vorbis quality4，前2秒淡入、末3秒淡出，未做增益/变调；未改动物叫声或朗读音频。
