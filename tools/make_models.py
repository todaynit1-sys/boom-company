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


for f in (desk, chair, cabinet, plant, sofa, table, trash):
    f()
print('done')
