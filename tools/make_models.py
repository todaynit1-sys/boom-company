# 가구 모델 만들기: blender --background --python tools/make_models.py
# 게임 좌표(x, y위, z) → 블렌더 좌표(x, -z, y위). 물건의 중심이 원점, 크기는 props.js의 size와 같다.
import bpy, bmesh, math, os, random
from mathutils import Vector

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'models')
os.makedirs(OUT, exist_ok=True)
MATS = {}


def mat(name, col, rough=.6, metal=0.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    c = [((int(col[i:i + 2], 16) / 255) ** 2.2) for i in (1, 3, 5)]
    b.inputs['Base Color'].default_value = (c[0], c[1], c[2], 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    MATS[name] = m
    return m


def reset():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for me in list(bpy.data.meshes):
        bpy.data.meshes.remove(me)


def finish(o, m, bevel=0.0, seg=3, smooth=True):
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if bevel > 0:
        b = o.modifiers.new('bevel', 'BEVEL')
        b.width = bevel
        b.segments = seg
        b.limit_method = 'ANGLE'
    if smooth:
        o.data.shade_smooth()
        w = o.modifiers.new('wn', 'WEIGHTED_NORMAL')
        w.keep_sharp = False
    o.data.materials.append(m)
    o.select_set(False)
    return o


# 게임 좌표로 받는다: 중심 (x, y, z), 크기 (w, h, d)
def box(x, y, z, w, h, d, m, bevel=.012, seg=3, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -z, y), rotation=rot)
    o = bpy.context.active_object
    o.scale = (w, d, h)
    return finish(o, m, min(bevel, w * .45, h * .45, d * .45), seg)


def cyl(x, y, z, r1, r2, h, m, n=24, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=n, radius1=r2, radius2=r1, depth=h, location=(x, -z, y), rotation=rot)
    return finish(bpy.context.active_object, m, bevel, 2)


def ball(x, y, z, rx, ry, rz, m, seg=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=1, location=(x, -z, y))
    o = bpy.context.active_object
    o.scale = (rx, rz, ry)
    return finish(o, m)


def export(name):
    # 같은 재질끼리 한 덩어리로 합쳐 그리는 횟수를 줄인다
    groups = {}
    for o in list(bpy.context.scene.objects):
        groups.setdefault(o.data.materials[0].name, []).append(o)
    for objs in groups.values():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.convert(target='MESH')
        if len(objs) > 1:
            bpy.ops.object.join()
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, name + '.glb'), export_format='GLB', use_selection=True, export_apply=True, export_yup=True)
    print('exported', name)


# ───── 책상 1.6 × .74 × .8  (가림판이 -z 쪽)
def desk():
    reset()
    w, h, d = 1.6, .74, .8
    top, leg, lam, metal, dark = mat('deskTop', '#d9b98a', .45), mat('deskLeg', '#e9e6df', .55), mat('deskLam', '#e3dfd6', .6), mat('chrome', '#cfd3d8', .25, 1), mat('plasticDark', '#2a2c31', .5)
    box(0, h / 2 - .02, 0, w, .04, d, top, .016, 4)
    box(0, h / 2 - .043, 0, w - .02, .006, d - .02, mat('deskEdge', '#b9976a', .5), .002, 1)
    for s in (-1, 1):
        box(s * (w / 2 - .035), -.005, 0, .04, h - .05, d - .08, leg, .012)
        box(s * (w / 2 - .035), -h / 2 + .012, 0, .06, .024, d - .02, metal, .008)
    box(0, .1, -d / 2 + .07, w - .12, .42, .02, lam, .006)
    # 서랍장(오른쪽) — 손잡이는 +z 쪽
    px = w / 2 - .27
    box(px, -.12, .02, .4, .5, d - .12, lam, .012)
    for i, y in enumerate((.06, -.1, -.27)):
        box(px, y, d / 2 - .045, .36, .14 if i < 2 else .16, .012, leg, .006)
        box(px, y + .03, d / 2 - .034, .12, .012, .014, metal, .004)
    cyl(-w / 2 + .3, h / 2 + .001, -d / 2 + .14, .03, .03, .004, dark, 20)
    # 책상 위 소품: 연필꽂이(오른쪽 뒤), 탁상 달력(왼쪽 뒤)
    ty = h / 2
    cyl(.4, ty + .05, -.29, .035, .032, .1, mat('penCup', '#3d4652', .5), 20, .004)
    for i, (c, dx, dz) in enumerate((('#e5342b', -.01, .005), ('#2f6bff', .012, -.008), ('#f2c23a', .004, .012), ('#2a2c31', -.012, -.01))):
        cyl(.4 + dx, ty + .12, -.29 + dz, .005, .005, .14, mat('pen' + str(i), c, .4), 8, rot=(dz * 6, dx * 6, 0))
    box(-.38, ty + .055, -.28, .15, .1, .012, mat('calPage', '#fbfaf5', .8), .002, 1, rot=(math.radians(-18), 0, 0))
    box(-.38, ty + .055, -.3, .15, .1, .012, mat('calBack', '#2f5fb3', .6), .002, 1, rot=(math.radians(18), 0, 0))
    box(-.38, ty + .095, -.28, .15, .02, .014, mat('calTop', '#e5342b', .5), .002, 1, rot=(math.radians(-18), 0, 0))
    export('desk')


# ───── 의자 .56 × .95 × .56  (등받이가 -z 쪽)
def chair():
    reset()
    fab, dark, metal, rub = mat('chairFabric', '#2f333b', .9), mat('plasticDark', '#2a2c31', .5), mat('chrome', '#cfd3d8', .25, 1), mat('rubber', '#141414', .9)
    box(0, -.02, .01, .48, .085, .47, fab, .04, 5)
    box(0, -.07, .01, .42, .03, .4, dark, .012)
    # 살짝 휜 등받이: 세 조각을 기울여 잇는다
    box(0, .3, -.215, .42, .44, .05, fab, .024, 5, rot=(math.radians(-6), 0, 0))
    box(0, .1, -.225, .1, .2, .03, dark, .01)
    cyl(0, -.2, 0, .026, .03, .24, metal, 16)
    cyl(0, -.33, 0, .04, .045, .06, dark, 16)
    for k in range(5):
        a = k * math.tau / 5
        x, z = math.sin(a) * .135, math.cos(a) * .135
        box(x, -.405, z, .045, .028, .27, dark, .01, 2, rot=(0, 0, a))
        ball(math.sin(a) * .255, -.445, math.cos(a) * .255, .03, .03, .03, rub, 12)
    for s in (-1, 1):
        box(s * .265, .145, .0, .05, .028, .28, dark, .012)
        box(s * .265, .06, -.06, .028, .16, .03, dark, .008)
    export('chair')


# ───── 캐비닛 .9 × 1.8 × .45  (문이 +z 쪽)
def cabinet():
    reset()
    w, h, d = .9, 1.8, .45
    body, door, metal = mat('cabBody', '#8c949c', .5, .2), mat('cabDoor', '#9aa2aa', .45, .2), mat('chrome', '#cfd3d8', .25, 1)
    box(0, 0, -.006, w, h, d - .012, body, .014, 4)
    for s in (-1, 1):
        box(s * (w / 4 - .002), .01, d / 2 - .01, w / 2 - .016, h - .06, .014, door, .006)
        box(s * .045, .1, d / 2 + .006, .016, .14, .016, metal, .006)
        for y in (.62, .55, .48):
            box(s * (w / 4), y, d / 2 - .001, w / 2 - .12, .01, .004, body, .001, 1)
    box(0, -h / 2 + .03, 0, w - .04, .06, d - .06, mat('plasticDark', '#2a2c31', .5), .006)
    export('cabinet')


# ───── 화분 .4 × 1.05 × .4
def plant():
    reset()
    random.seed(7)
    pot, soil, stem = mat('pot', '#f1ede4', .35), mat('soil', '#4a3524', 1), mat('stem', '#4f7d3a', .7)
    leafs = [mat('leaf1', '#2f8a43', .55), mat('leaf2', '#3fa052', .55), mat('leaf3', '#27733a', .6)]
    cyl(0, -.36, 0, .17, .125, .33, pot, 28, .012)
    cyl(0, -.2, 0, .178, .17, .02, pot, 28, .006)
    cyl(0, -.2, 0, .15, .15, .012, soil, 24)
    # 줄기와 잎: 길쭉한 타원 잎을 사방으로
    for i in range(16):
        a = i * 2.399 + random.uniform(-.2, .2)
        t = i / 15
        ht = -.15 + t * .5
        r = .06 + .1 * math.sin(t * math.pi) + random.uniform(0, .03)
        x, z = math.sin(a) * r, math.cos(a) * r
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=1, location=(x, -z, ht + .12))
        o = bpy.context.active_object
        o.scale = (.045, .012, .12 - t * .03)
        o.rotation_euler = (math.radians(38 + random.uniform(-12, 18)), 0, a)
        finish(o, random.choice(leafs))
        cyl(x * .45, (ht - .19) / 2 + .02, z * .45, .006, .008, max(.05, ht + .19), stem, 6, rot=(math.radians(8) * math.cos(a), math.radians(8) * math.sin(a), 0))
    for (x, y, z, r) in ((0, .34, 0, .1), (.05, .26, .04, .08), (-.05, .28, -.04, .08)):
        ball(x, y, z, r * .55, r * 1.3, r * .2, random.choice(leafs), 12)
    export('plant')


# ───── 소파 1.7 × .78 × .8  (등받이가 -z 쪽)
def sofa():
    reset()
    w, h, d = 1.7, .78, .8
    fab, leg = mat('sofaFabric', '#7d8894', .95), mat('woodDark', '#4a3324', .5)
    box(0, -.22, 0, w - .04, .2, d - .04, fab, .05, 5)
    for s in (-1, 1):
        box(s * (w / 4 - .05), -.07, .05, w / 2 - .22, .16, d - .26, fab, .06, 6)
        box(s * (w / 4 - .05), .17, -d / 2 + .15, w / 2 - .22, .42, .2, fab, .07, 6, rot=(math.radians(-8), 0, 0))
        box(s * (w / 2 - .09), -.02, 0, .17, .46, d - .02, fab, .07, 6)
        for z in (-1, 1):
            cyl(s * (w / 2 - .12), -h / 2 + .035, z * (d / 2 - .1), .025, .018, .07, leg, 12)
    export('sofa')


# ───── 회의 탁자 3.2 × .74 × 1.2
def table():
    reset()
    w, h, d = 3.2, .74, 1.2
    top, metal, dark = mat('tableTop', '#c9a777', .4), mat('tableLeg', '#4b5158', .4, .8), mat('plasticDark', '#2a2c31', .5)
    box(0, h / 2 - .025, 0, w, .05, d, top, .024, 5)
    for s in (-1, 1):
        box(s * (w / 2 - .45), -.03, 0, .09, h - .06, d - .36, metal, .02)
        box(s * (w / 2 - .45), -h / 2 + .015, 0, .14, .03, d - .2, metal, .01)
        box(s * .5, h / 2 + .002, 0, .22, .006, .1, dark, .002, 1)
    box(0, .2, 0, w - 1.0, .1, .05, metal, .012)
    export('table')


# ───── 휴지통 .26 × .32 × .26
def trash():
    reset()
    m = mat('binMesh', '#3a3d43', .55, .5)
    cyl(0, 0, 0, .13, .1, .31, m, 24, .006)
    cyl(0, .152, 0, .134, .134, .012, mat('chrome', '#cfd3d8', .25, 1), 24, .004)
    cyl(0, .12, 0, .118, .118, .01, mat('paper', '#f4f1ea', .9), 20)
    export('trash')


# ───── 정수기 .34 × 1.3 × .34  (물 나오는 곳이 +z 쪽)
def watercooler():
    reset()
    body, dark, bottle, cap = mat('coolerBody', '#eef0f2', .4), mat('plasticDark', '#2a2c31', .5), mat('coolerWater', '#7fb8ea', .08), mat('coolerCap', '#2f6bff', .4)
    box(0, -.27, 0, .32, .76, .32, body, .03, 4)
    box(0, .1, 0, .3, .02, .3, mat('chrome', '#cfd3d8', .25, 1), .006)
    box(0, -.1, .162, .2, .16, .01, dark, .02, 3)
    for s in (-1, 1):
        box(s * .045, -.06, .175, .03, .04, .03, mat('tap' + ('C' if s < 0 else 'H'), '#2f6bff' if s < 0 else '#d6402f', .35), .008)
    box(0, -.2, .17, .14, .02, .06, dark, .006)
    cyl(0, .35, 0, .14, .14, .44, bottle, 28, .03)
    cyl(0, .12, 0, .07, .14, .06, bottle, 28)
    cyl(0, .58, 0, .05, .05, .04, cap, 20, .006)
    export('watercooler')


# ───── 파티션 1.6 × 1.15 × .06
def partition():
    reset()
    w, h, d = 1.6, 1.15, .06
    fab, frame = mat('partFabric', '#8f99a6', .95), mat('partFrame', '#c9ccd1', .4, .3)
    box(0, 0, 0, w - .04, h - .04, d - .01, fab, .01)
    box(0, h / 2 - .02, 0, w, .04, d, frame, .012)
    for s in (-1, 1):
        box(s * (w / 2 - .02), -.02, 0, .04, h - .04, d, frame, .012)
        box(s * (w / 2 - .12), -h / 2 + .015, 0, .05, .03, .3, frame, .01)
    # 책상 쪽(+z) 면에 붙인 메모지와 출력물
    for i, (x, y, c) in enumerate(((-.45, .32, '#ffe66d'), (-.36, .28, '#ff9fb2'), (-.4, .18, '#9be7a1'), (.42, .3, '#ffe66d'))):
        box(x, y, d / 2 + .002, .075, .075, .003, mat('note' + str(i), c, .8), .001, 1, rot=(0, math.radians(random.uniform(-8, 8)), 0))
    box(.1, .26, d / 2 + .002, .21, .28, .003, mat('printout', '#fbfaf5', .8), .001, 1)
    for k in range(5):
        box(.1, .34 - k * .04, d / 2 + .004, .15, .008, .002, mat('printLine', '#9aa0a8', .8), 0, 1)
    export('partition')


# ───── 낮은 수납장 .9 × .75 × .42  (문이 +z)
def lowcab():
    reset()
    w, h, d = .9, .75, .42
    body, door, top, metal = mat('deskLeg', '#e9e6df', .55), mat('deskLam', '#e3dfd6', .6), mat('deskTop', '#d9b98a', .45), mat('chrome', '#cfd3d8', .25, 1)
    box(0, -.02, 0, w, h - .04, d, body, .014)
    box(0, h / 2 - .02, 0, w + .02, .04, d + .02, top, .012)
    for s in (-1, 1):
        box(s * (w / 4), -.03, d / 2 + .004, w / 2 - .02, h - .12, .012, door, .006)
        box(s * .05, .05, d / 2 + .016, .015, .1, .015, metal, .005)
    export('lowcab')


# ───── 책장 1.6 × 2.1 × .4  (열린 쪽 +z)
def bookshelf():
    reset()
    random.seed(11)
    w, h, d = 1.6, 2.1, .4
    wood = mat('woodDark', '#5b3b24', .5)
    box(0, 0, -d / 2 + .01, w, h, .02, wood, .004)
    for s in (-1, 1):
        box(s * (w / 2 - .015), 0, 0, .03, h, d, wood, .006)
    shelves = 5
    for i in range(shelves + 1):
        y = -h / 2 + .015 + i * (h - .03) / shelves
        box(0, y, 0, w - .03, .03, d, wood, .004)
    cols = ['#7a2030', '#1f3f6b', '#2f5f3a', '#c9a24a', '#e9e1cf', '#3a2a22', '#5a3e8a', '#2f6bff', '#e3b23c']
    for i in range(shelves):
        y0 = -h / 2 + .03 + i * (h - .03) / shelves
        x = -w / 2 + .05
        while x < w / 2 - .1:
            bw, bh = random.uniform(.03, .06), random.uniform(.24, .34)
            if random.random() < .12:
                x += .08; continue
            box(x + bw / 2, y0 + bh / 2, .02, bw, bh, d - .1, mat('book' + str(cols.index(c := random.choice(cols))), c, .7), .004, 2)
            x += bw + .003
    export('bookshelf')


# ───── 냉장고 .65 × 1.75 × .65  (문이 +z)
def fridge():
    reset()
    w, h, d = .65, 1.75, .65
    body, metal = mat('fridgeBody', '#e9ebee', .3, .1), mat('chrome', '#cfd3d8', .25, 1)
    box(0, 0, 0, w, h, d - .02, body, .03, 4)
    box(0, .48, d / 2 - .005, w - .02, .76, .02, body, .012)
    box(0, -.39, d / 2 - .005, w - .02, .94, .02, body, .012)
    box(-w / 2 + .07, .2, d / 2 + .02, .03, .3, .03, metal, .012)
    box(-w / 2 + .07, -.12, d / 2 + .02, .03, .3, .03, metal, .012)
    export('fridge')


# ───── 카페 테이블 .7 × .74 × .7 / 카페 의자 .44 × .86 × .44 / 스툴 .34 × .46 × .34
def cafetable():
    reset()
    top, metal = mat('deskTop', '#d9b98a', .45), mat('tableLeg', '#2d3036', .4, .7)
    cyl(0, .35, 0, .35, .35, .04, top, 40, .012)
    cyl(0, 0, 0, .03, .03, .66, metal, 16)
    cyl(0, -.355, 0, .22, .24, .03, metal, 32, .008)
    export('cafetable')


def cafechair():
    reset()
    wood, metal = mat('woodWarm', '#b9875a', .5), mat('tableLeg', '#2d3036', .4, .7)
    box(0, .02, .02, .42, .04, .4, wood, .015)
    box(0, .26, -.19, .4, .2, .03, wood, .012, 4, rot=(math.radians(-8), 0, 0))
    for x in (-1, 1):
        for z in (-1, 1):
            cyl(x * .17, -.21, z * .16, .015, .015, .44, metal, 10)
        cyl(x * .17, .14, -.19, .013, .013, .26, metal, 10)
    export('cafechair')


def stool():
    reset()
    seat, metal = mat('stoolSeat', '#c9281f', .5), mat('chrome', '#cfd3d8', .25, 1)
    cyl(0, .2, 0, .17, .16, .06, seat, 28, .02)
    for k in range(4):
        a = k * math.tau / 4 + math.pi / 4
        cyl(math.sin(a) * .11, -.05, math.cos(a) * .11, .012, .012, .44, metal, 10, rot=(math.cos(a) * .12, -math.sin(a) * .12, 0))
    cyl(0, -.1, 0, .12, .12, .012, metal, 24)
    export('stool')


# ───── 접이식 의자 .44 × .82 × .44 / 벤치 1.6 × .45 × .48
def foldchair():
    reset()
    seat, metal = mat('plasticDark', '#2a2c31', .5), mat('chrome', '#cfd3d8', .25, 1)
    box(0, .02, .03, .4, .03, .38, seat, .012)
    box(0, .26, -.19, .38, .2, .02, seat, .012, 4, rot=(math.radians(-6), 0, 0))
    for s in (-1, 1):
        box(s * .2, -.2, 0, .02, .44, .02, metal, .006, 2, rot=(math.radians(18), 0, 0))
        box(s * .2, -.2, 0, .02, .44, .02, metal, .006, 2, rot=(math.radians(-18), 0, 0))
        box(s * .2, .2, -.2, .02, .4, .02, metal, .006)
    export('foldchair')


def bench():
    reset()
    wood, metal = mat('woodWarm', '#b9875a', .5), mat('tableLeg', '#2d3036', .4, .7)
    for i in range(4):
        box(0, .2, -.18 + i * .12, 1.6, .03, .1, wood, .01)
    for s in (-1, 1):
        box(s * .65, -.02, 0, .05, .42, .44, metal, .01)
    export('bench')


for f in (desk, chair, cabinet, plant, sofa, table, trash, watercooler, partition, lowcab, bookshelf, fridge, cafetable, cafechair, stool, foldchair, bench):
    f()
print('done')
