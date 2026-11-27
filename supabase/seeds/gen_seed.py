#!/usr/bin/env python3
"""Gera supabase/seeds/der_ficticio.sql — dados fictícios do DER do Painel de Entregas.

Determinístico (random.seed fixo). Data de referência: 27/11/2026.
dia_semana ISO: 1=seg … 7=dom.
"""
import json
import random
from datetime import date, datetime, timedelta, timezone

random.seed(20261127)
HOJE = date(2026, 11, 27)
BRT = timezone(timedelta(hours=-3))
OUT = "supabase/seeds/der_ficticio.sql"

lines = []


def q(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, (dict, list)):
        return "'" + json.dumps(v, ensure_ascii=False).replace("'", "''") + "'::jsonb"
    if isinstance(v, datetime):
        return "'" + v.isoformat() + "'"
    if isinstance(v, date):
        return "'" + v.isoformat() + "'"
    return "'" + str(v).replace("'", "''") + "'"


def insert(table, cols, rows):
    if not rows:
        return
    lines.append(f"\n-- {table} ({len(rows)})")
    for i in range(0, len(rows), 200):
        chunk = rows[i:i + 200]
        vals = ",\n  ".join("(" + ", ".join(q(r[c]) for c in cols) + ")" for r in chunk)
        lines.append(f"insert into public.{table} ({', '.join(cols)}) values\n  {vals};")


def ts(d, h=0, m=0):
    return datetime(d.year, d.month, d.day, h, m, tzinfo=BRT)


def slug(s):
    import unicodedata
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return "-".join("".join(c if c.isalnum() else " " for c in s).split())


# ---------------------------------------------------------------------------
# Usuários fictícios (allowed_users) — inativos: não conseguem logar
# ---------------------------------------------------------------------------
ANA, CARLOS, JULIANA = "ana.ribeiro@example.com", "carlos.menezes@example.com", "juliana.prado@example.com"
USERS = [
    (ANA, "Ana Ribeiro (fictício)", "gestao"),
    (CARLOS, "Carlos Menezes (fictício)", "logistica"),
    (JULIANA, "Juliana Prado (fictício)", "atendimento"),
]

# ---------------------------------------------------------------------------
# Geografia
# ---------------------------------------------------------------------------
estados = [
    dict(id=1, nome="São Paulo", sigla="SP", status="ATIVO", atualizado_em=ts(date(2026, 10, 30), 16, 5)),
    dict(id=2, nome="Rio de Janeiro", sigla="RJ", status="ATIVO", atualizado_em=ts(date(2026, 10, 30), 16, 5)),
    dict(id=3, nome="Minas Gerais", sigla="MG", status="INATIVO", atualizado_em=ts(date(2026, 10, 28), 9, 0)),
]
cidades = [
    dict(id=1, estado_id=1, nome="São Paulo", codigo_ibge="3550308", status="ATIVO", vtex_ref="area-sp-sao-paulo"),
    dict(id=2, estado_id=2, nome="Niterói", codigo_ibge="3303302", status="ATIVO", vtex_ref="area-rj-niteroi"),
    dict(id=3, estado_id=1, nome="Guarulhos", codigo_ibge="3518800", status="INATIVO", vtex_ref="area-sp-guarulhos"),
]
zonas = [
    dict(id=1, cidade_id=1, nome="Zona Oeste"), dict(id=2, cidade_id=1, nome="Zona Sul"),
    dict(id=3, cidade_id=1, nome="Centro"), dict(id=4, cidade_id=1, nome="Zona Norte"),
    dict(id=5, cidade_id=1, nome="Zona Leste"),
    dict(id=6, cidade_id=2, nome="Região das Praias da Baía"), dict(id=7, cidade_id=2, nome="Região Oceânica"),
]
# (nome, cidade_id, zona_id, prefixo CEP, status, peso de assinantes)
BAIRROS = [
    ("Pinheiros", 1, 1, "05422", "ATIVO", 9), ("Vila Madalena", 1, 1, "05433", "ATIVO", 5),
    ("Perdizes", 1, 1, "05014", "ATIVO", 4), ("Butantã", 1, 1, "05503", "INATIVO", 2),
    ("Lapa", 1, 1, "05074", "ATIVO", 2), ("Alto de Pinheiros", 1, 1, "05447", "ATIVO", 3),
    ("Moema", 1, 2, "04077", "ATIVO", 6), ("Vila Mariana", 1, 2, "04117", "ATIVO", 4),
    ("Itaim Bibi", 1, 2, "04533", "ATIVO", 4), ("Brooklin", 1, 2, "04571", "ATIVO", 3),
    ("Campo Belo", 1, 2, "04617", "ATIVO", 2), ("Saúde", 1, 2, "04143", "ATIVO", 2),
    ("Bela Vista", 1, 3, "01310", "ATIVO", 2), ("Consolação", 1, 3, "01302", "ATIVO", 2),
    ("República", 1, 3, "01045", "INATIVO", 0), ("Liberdade", 1, 3, "01503", "ATIVO", 1),
    ("Santana", 1, 4, "02012", "ATIVO", 2), ("Tucuruvi", 1, 4, "02304", "INATIVO", 0),
    ("Tatuapé", 1, 5, "03306", "ATIVO", 2), ("Mooca", 1, 5, "03102", "ATIVO", 2),
    ("Vila Formosa", 1, 5, "03356", "INATIVO", 0),
    ("Icaraí", 2, 6, "24220", "ATIVO", 6), ("Santa Rosa", 2, 6, "24240", "ATIVO", 3),
    ("Ingá", 2, 6, "24210", "ATIVO", 2), ("São Francisco", 2, 6, "24360", "ATIVO", 2),
    ("Centro", 2, 6, "24020", "ATIVO", 1), ("Itaipu", 2, 7, "24340", "ATIVO", 1),
    ("Piratininga", 2, 7, "24350", "ATIVO", 1), ("Camboinhas", 2, 7, "24358", "INATIVO", 0),
    ("Centro", 3, None, "07010", "INATIVO", 0), ("Vila Galvão", 3, None, "07071", "INATIVO", 0),
]
cid_by_id = {c["id"]: c for c in cidades}
bairros, peso_bairro = [], {}
for i, (nome, cid, zid, pref, st, peso) in enumerate(BAIRROS, start=1):
    bairros.append(dict(id=i, cidade_id=cid, zona_id=zid, nome=nome, status=st,
                        vtex_ref=f"{cid_by_id[cid]['vtex_ref']}-{slug(nome)}", _pref=pref))
    peso_bairro[i] = peso
B = {(b["nome"], b["cidade_id"]): b["id"] for b in bairros}
PINHEIROS, VMADALENA, BUTANTA = B[("Pinheiros", 1)], B[("Vila Madalena", 1)], B[("Butantã", 1)]
MOEMA, ITAIM = B[("Moema", 1)], B[("Itaim Bibi", 1)]
ICARAI, STAROSA = B[("Icaraí", 2)], B[("Santa Rosa", 2)]

RUAS_PINHEIROS = ["Rua dos Pinheiros", "Rua Teodoro Sampaio", "Rua Cardeal Arcoverde", "Rua Fradique Coutinho",
                  "Rua Artur de Azevedo", "Rua Capote Valente", "Rua Mourato Coelho", "Rua Ferreira de Araújo",
                  "Rua Butantã", "Rua Cunha Gago", "Rua Paes Leme", "Rua Joaquim Antunes", "Rua Lisboa",
                  "Rua Arruda Alvim"]
POOL = ["Rua das Acácias", "Rua dos Ipês", "Rua Bahia", "Rua Pernambuco", "Rua Sergipe", "Rua Alagoas",
        "Rua Ceará", "Rua Paraíba", "Rua Maranhão", "Rua Goiás", "Rua Tocantins", "Rua das Palmeiras",
        "Rua dos Jacarandás", "Rua Tupi", "Rua Aimorés", "Rua Bororós", "Rua Monte Alegre", "Rua das Hortênsias",
        "Rua das Magnólias", "Rua dos Girassóis", "Rua Dom Pedro II", "Rua Barão de Itapetininga",
        "Rua Visconde de Ouro Preto", "Rua Marquês de Paraná", "Rua Coronel Moreira César", "Rua Doutor Arnaldo",
        "Rua Professor Lima", "Rua Santa Clara", "Rua São Benedito", "Rua Gonçalves Dias", "Rua Castro Alves",
        "Rua Machado de Assis", "Rua Cecília Meireles", "Rua Tiradentes", "Rua Quinze de Novembro",
        "Rua Sete de Setembro", "Avenida das Américas", "Travessa do Sol", "Alameda dos Anjos", "Rua do Ouvidor"]

ruas = []
rid = 0
for b in bairros:
    nomes = RUAS_PINHEIROS if b["id"] == PINHEIROS else random.sample(POOL, random.randint(8, 13))
    for j, nome in enumerate(nomes):
        rid += 1
        cep = f"{b['_pref']}{(j * 37 + 10) % 1000:03d}"
        st = "ATIVO" if b["status"] == "ATIVO" else "INATIVO"
        if b["status"] == "ATIVO" and b["id"] != PINHEIROS and random.random() < 0.07:
            st = "INATIVO"
        ruas.append(dict(id=rid, bairro_id=b["id"], logradouro=nome, cep=cep, status=st,
                         segue_regra_bairro=True, vtex_ref=f"{b['vtex_ref']}-{slug(nome)}"))
R = {(r["logradouro"], r["bairro_id"]): r["id"] for r in ruas}
rua_by_id = {r["id"]: r for r in ruas}
bairro_by_id = {b["id"]: b for b in bairros}
# Pinheiros "Parcial": 3 ruas inativadas na v40
PIN_INATIVAS = [R[(n, PINHEIROS)] for n in ("Rua Lisboa", "Rua Arruda Alvim", "Rua Joaquim Antunes")]
for x in PIN_INATIVAS:
    rua_by_id[x]["status"] = "INATIVO"
# Regras próprias por rua (v42)
OVR = {R[("Rua Teodoro Sampaio", PINHEIROS)]: [3, 5], R[("Rua Cardeal Arcoverde", PINHEIROS)]: [2, 4]}
rua_moema = next(r["id"] for r in ruas if r["bairro_id"] == MOEMA and r["status"] == "ATIVO")
OVR[rua_moema] = [1, 4]
for x in OVR:
    rua_by_id[x]["segue_regra_bairro"] = False
# Ruas com CEP corrigido após a falha da v43 (CEP antigo inválido só no log do envio)
CEP_INVALIDOS = {
    next(r["id"] for r in ruas if r["bairro_id"] == ICARAI): "24229999",
    next(r["id"] for r in ruas if r["bairro_id"] == STAROSA): "24241999",
}

# ---------------------------------------------------------------------------
# Publicações (v39–v44) e regras
# ---------------------------------------------------------------------------
pubs, itens, envios, rascunhos = [], [], [], []
regras, regra_dias = [], []
analises, impactos = [], []


def pub(id_, autor, status, tipo, criado, publicado=None, origem=None):
    p = dict(id=id_, autor_email=autor, publicacao_origem_id=origem, status=status, tipo=tipo,
             payload=None, total_itens=0, criado_em=criado, publicado_em=publicado, _itens=[])
    pubs.append(p)
    return p


def ref(tipo, eid):
    return {"CIDADE": cid_by_id, "BAIRRO": bairro_by_id, "RUA": rua_by_id}[tipo][eid]["vtex_ref"]


def item(p, tipo, eid, acao, antes, depois, st, autor, quando, rascunhos_extra=0):
    it = dict(id=len(itens) + 1, publicacao_id=p["id"], entidade_tipo=tipo, entidade_id=eid, acao=acao,
              valor_anterior=antes, valor_novo=depois, status_item=st)
    itens.append(it)
    p["_itens"].append(it)
    for k in range(rascunhos_extra + 1):
        rascunhos.append(dict(id=len(rascunhos) + 1, usuario_email=autor, publicacao_id=p["id"],
                              entidade_tipo=tipo, entidade_id=eid, acao=acao, valor_anterior=antes,
                              valor_novo=depois, criado_em=quando + timedelta(minutes=7 * k)))
    return it


def regra(nivel, eid, p, ini, dias, fim=None):
    r = dict(id=len(regras) + 1, nivel=nivel, cidade_id=eid if nivel == "CIDADE" else None,
             bairro_id=eid if nivel == "BAIRRO" else None, rua_id=eid if nivel == "RUA" else None,
             publicacao_id=p["id"] if p else None, vigencia_inicio=ini, vigencia_fim=fim, _dias=dias)
    regras.append(r)
    for d in dias:
        regra_dias.append(dict(id=len(regra_dias) + 1, regra_id=r["id"], dia_semana=d))
    return r


def finaliza(p):
    p["total_itens"] = len(p["_itens"])
    p["payload"] = {
        "publicacao_id": p["id"], "tipo": p["tipo"], "origem": p["publicacao_origem_id"],
        "itens": [{"nivel": it["entidade_tipo"], "vtex_ref": ref(it["entidade_tipo"], it["entidade_id"]),
                   "acao": it["acao"], **(it["valor_novo"] or {})} for it in p["_itens"]],
    }


def envio(p, tent, quando, http, resp, erro=None):
    envios.append(dict(id=len(envios) + 1, publicacao_id=p["id"], tentativa=tent, request_payload=p["payload"],
                       http_status=http, response_body=resp, erro=erro, enviado_em=quando))


def ok_resp(p, cidades_ids):
    return {"status": "ok", "protocolo": f"IOTA-{p['id']:05d}",
            "regioes": [{"cidade": cid_by_id[c]["nome"], "status": "publicado"} for c in cidades_ids]}


D = lambda d: {"dias": d}
S = lambda s: {"status": s}

# v39 — configuração inicial
d = date(2026, 10, 30)
p39 = pub(39, ANA, "SUCESSO", "NORMAL", ts(d, 10, 20), ts(d, 16, 5))
item(p39, "CIDADE", 1, "ATIVAR", S("INATIVO"), S("ATIVO"), "SUCESSO", ANA, ts(d, 9, 0))
item(p39, "CIDADE", 2, "ATIVAR", S("INATIVO"), S("ATIVO"), "SUCESSO", ANA, ts(d, 9, 5))
item(p39, "CIDADE", 1, "DIAS", D([]), D([2, 4, 6]), "SUCESSO", ANA, ts(d, 9, 20))
item(p39, "CIDADE", 2, "DIAS", D([]), D([3, 6]), "SUCESSO", ANA, ts(d, 9, 30))
item(p39, "BAIRRO", VMADALENA, "DIAS", D([2, 4, 6]), D([2, 4]), "SUCESSO", CARLOS, ts(d, 9, 50))
item(p39, "BAIRRO", ITAIM, "DIAS", D([2, 4, 6]), D([1, 3, 5]), "SUCESSO", CARLOS, ts(d, 10, 0))
finaliza(p39)
envio(p39, 1, ts(d, 16, 4), 200, ok_resp(p39, [1, 2]))
V0 = date(2026, 11, 2)
regra("CIDADE", 1, p39, V0, [2, 4, 6])
regra("CIDADE", 2, p39, V0, [3, 6])
r_vm_old = regra("BAIRRO", VMADALENA, p39, V0, [2, 4], fim=date(2026, 11, 16))
regra("BAIRRO", ITAIM, p39, V0, [1, 3, 5])

# v40 — Pinheiros com dias próprios e 3 ruas inativadas
d = date(2026, 11, 5)
p40 = pub(40, CARLOS, "SUCESSO", "NORMAL", ts(d, 11, 0), ts(d, 15, 30))
item(p40, "BAIRRO", PINHEIROS, "DIAS", D([2, 4, 6]), D([2, 3, 4, 6]), "SUCESSO", CARLOS, ts(d, 10, 10), 1)
for x in PIN_INATIVAS:
    item(p40, "RUA", x, "INATIVAR", S("ATIVO"), S("INATIVO"), "SUCESSO", CARLOS, ts(d, 10, 30))
finaliza(p40)
envio(p40, 1, ts(d, 15, 29), 200, ok_resp(p40, [1]))
regra("BAIRRO", PINHEIROS, p40, date(2026, 11, 9), [2, 3, 4, 6])

# v41 — VTEX fora do ar na 1ª tentativa, reprocessada com sucesso
d = date(2026, 11, 12)
p41 = pub(41, ANA, "SUCESSO", "NORMAL", ts(d, 13, 40), ts(d, 15, 41))
item(p41, "BAIRRO", VMADALENA, "DIAS", D([2, 4]), D([2, 4, 6]), "SUCESSO", ANA, ts(d, 13, 0))
item(p41, "BAIRRO", BUTANTA, "INATIVAR", S("ATIVO"), S("INATIVO"), "SUCESSO", ANA, ts(d, 13, 15))
finaliza(p41)
envio(p41, 1, ts(d, 14, 2), 503, {"message": "VTEX Logistics indisponível", "retry_after": 900},
      "VTEX retornou 503 (Service Unavailable)")
envio(p41, 2, ts(d, 15, 40), 200, ok_resp(p41, [1]))
regra("BAIRRO", VMADALENA, p41, date(2026, 11, 16), [2, 4, 6])

# v42 — ruas com regra própria
d = date(2026, 11, 18)
p42 = pub(42, CARLOS, "SUCESSO", "NORMAL", ts(d, 9, 30), ts(d, 11, 12))
for x, dias in OVR.items():
    base = [2, 3, 4, 6] if rua_by_id[x]["bairro_id"] == PINHEIROS else [2, 4, 6]
    item(p42, "RUA", x, "DIAS", {"dias": base, "segue_regra_bairro": True},
         {"dias": dias, "segue_regra_bairro": False}, "SUCESSO", CARLOS, ts(d, 9, 0))
finaliza(p42)
envio(p42, 1, ts(d, 11, 11), 200, ok_resp(p42, [1]))
for x, dias in OVR.items():
    regra("RUA", x, p42, date(2026, 11, 23), dias)

# v43 — falha parcial: Niterói (CEPs inválidos no ViaCEP), São Paulo publicou
d = date(2026, 11, 24)
p43 = pub(43, ANA, "ERRO", "NORMAL", ts(d, 9, 50), None)
item(p43, "BAIRRO", MOEMA, "DIAS", D([2, 4, 6]), D([2, 3, 5]), "SUCESSO", ANA, ts(d, 9, 10))
item(p43, "BAIRRO", ICARAI, "DIAS", D([3, 6]), D([2, 5]), "ERRO", ANA, ts(d, 9, 20))
item(p43, "BAIRRO", STAROSA, "DIAS", D([3, 6]), D([2, 5]), "ERRO", ANA, ts(d, 9, 25))
finaliza(p43)
envio(p43, 1, ts(d, 10, 15), 207, {
    "status": "parcial", "protocolo": "IOTA-00043",
    "regioes": [
        {"cidade": "São Paulo", "status": "publicado"},
        {"cidade": "Niterói", "status": "erro", "motivo": "CEP inválido no ViaCEP",
         "ceps_invalidos": sorted(CEP_INVALIDOS.values()), "vtex": "estado anterior mantido"},
    ]}, "Niterói: 2 CEPs inválidos no ViaCEP — VTEX manteve o estado anterior")
regra("BAIRRO", MOEMA, p43, date(2026, 11, 26), [2, 3, 5])

# v44 — correção da v43 + ajuste em Pinheiros, em revisão (rascunho atual)
d = HOJE
p44 = pub(44, CARLOS, "REVISAO", "CORRECAO", ts(d, 9, 40), None, origem=43)
item(p44, "BAIRRO", ICARAI, "DIAS", D([3, 6]), D([2, 5]), "PENDENTE", CARLOS, ts(d, 8, 50))
item(p44, "BAIRRO", STAROSA, "DIAS", D([3, 6]), D([2, 5]), "PENDENTE", CARLOS, ts(d, 8, 55))
item(p44, "BAIRRO", PINHEIROS, "DIAS", D([2, 3, 4, 6]), D([2, 4, 6]), "PENDENTE", CARLOS, ts(d, 9, 5), 1)
item(p44, "RUA", R[("Rua Lisboa", PINHEIROS)], "ATIVAR", S("INATIVO"), S("ATIVO"), "PENDENTE", CARLOS, ts(d, 9, 20))
item(p44, "BAIRRO", BUTANTA, "ATIVAR", S("INATIVO"), S("ATIVO"), "PENDENTE", ANA, ts(d, 9, 30))
finaliza(p44)


# ---------------------------------------------------------------------------
# Regra efetiva por data (espelha vw_regra_efetiva_rua)
# ---------------------------------------------------------------------------
def regra_em(rua_id, dia):
    r = rua_by_id[rua_id]
    b = bairro_by_id[r["bairro_id"]]
    vig = [x for x in regras if x["vigencia_inicio"] <= dia and (x["vigencia_fim"] is None or x["vigencia_fim"] > dia)]
    if not r["segue_regra_bairro"]:
        for x in vig:
            if x["nivel"] == "RUA" and x["rua_id"] == rua_id:
                return x
    for x in vig:
        if x["nivel"] == "BAIRRO" and x["bairro_id"] == b["id"]:
            return x
    for x in vig:
        if x["nivel"] == "CIDADE" and x["cidade_id"] == b["cidade_id"]:
            return x
    return None


# ---------------------------------------------------------------------------
# Clientes, endereços e assinaturas
# ---------------------------------------------------------------------------
NOMES = ["Ana", "Bruno", "Camila", "Daniela", "Eduardo", "Fernanda", "Gustavo", "Helena", "Igor", "Juliana",
         "Lucas", "Mariana", "Nicolas", "Olívia", "Paulo", "Rafaela", "Sérgio", "Tatiana", "Vinícius", "Beatriz",
         "Caio", "Débora", "Felipe", "Gabriela", "Henrique", "Isabela", "João", "Larissa", "Marcelo", "Natália",
         "Otávio", "Patrícia", "Renato", "Sofia", "Thiago", "Valéria", "Yasmin", "André", "Cláudia", "Diego"]
SOBRENOMES = ["Silva", "Souza", "Oliveira", "Santos", "Lima", "Pereira", "Ferreira", "Almeida", "Costa", "Gomes",
              "Ribeiro", "Martins", "Carvalho", "Rocha", "Barbosa", "Araújo", "Teixeira", "Mendes", "Nunes",
              "Moreira", "Cardoso", "Correia", "Dias", "Castro", "Campos", "Freitas", "Pinto", "Monteiro",
              "Vieira", "Batista", "Moura", "Cavalcanti", "Rezende", "Fonseca", "Brandão", "Prado", "Siqueira"]
COMPL = [None, None, None, "Apto 12", "Apto 31", "Apto 54", "Apto 101", "Casa 2", "Bloco B, Apto 23", "Fundos"]

# ruas elegíveis: ativas hoje (ou Butantã, que tem assinaturas pausadas desde a v41)
elegiveis = []
for r in ruas:
    b = bairro_by_id[r["bairro_id"]]
    peso = peso_bairro[b["id"]]
    if peso == 0:
        continue
    if r["status"] == "ATIVO" or b["id"] == BUTANTA:
        if r["id"] in PIN_INATIVAS:
            continue
        elegiveis += [r["id"]] * peso

clientes, enderecos, assinaturas = [], [], []
usados = set()
N_CLIENTES = 460
for cid in range(1, N_CLIENTES + 1):
    while True:
        nome = f"{random.choice(NOMES)} {random.choice(SOBRENOMES)} {random.choice(SOBRENOMES)}"
        if nome not in usados:
            usados.add(nome)
            break
    rua_id = random.choice(elegiveis)
    b = bairro_by_id[rua_by_id[rua_id]["bairro_id"]]
    ddd = "11" if b["cidade_id"] == 1 else "21"
    email = slug(nome).replace("-", ".") + "@example.com"
    clientes.append(dict(id=cid, vtex_client_id=f"cl-{random.getrandbits(48):012x}", nome=nome, email=email,
                         telefone=f"+55{ddd}90000{cid:04d}"))
    n_end = 2 if random.random() < 0.06 else 1
    for k in range(n_end):
        rid_ = rua_id if k == 0 else random.choice(elegiveis)
        rua = rua_by_id[rid_]
        cep = rua["cep"]
        eid = len(enderecos) + 1
        enderecos.append(dict(id=eid, cliente_id=cid, rua_id=rid_, numero=str(random.randint(10, 2400)),
                              complemento=random.choice(COMPL), cep=cep))
        n_ass = 2 if random.random() < 0.08 else 1
        for _ in range(n_ass):
            aid = len(assinaturas) + 1
            bb = bairro_by_id[rua["bairro_id"]]
            reg = regra_em(rid_, HOJE)
            dias = reg["_dias"] if reg else [2, 4, 6]
            if bb["id"] == BUTANTA:
                status = "PAUSADA"
            else:
                status = random.choices(["ATIVA", "PAUSADA", "CANCELADA"], [86, 9, 5])[0]
            freq = random.choices(["SEMANAL", "QUINZENAL", "MENSAL"], [62, 28, 10])[0]
            dia = random.choice(dias)
            prox = None
            if status == "ATIVA":
                prox = HOJE + timedelta(days=(dia - HOJE.isoweekday()) % 7 or 7)
            assinaturas.append(dict(id=aid, cliente_id=cid, endereco_id=eid,
                                    vtex_subscription_id=f"SUB-{random.getrandbits(40):010X}", status=status,
                                    frequencia=freq, dia_entrega=dia, proximo_ciclo=prox, _rua=rid_,
                                    _bairro=bb["id"]))
end_by_id = {e["id"]: e for e in enderecos}

# CEPs inválidos (antes da correção) ficam fora dos endereços; o CEP atual já é o corrigido.

# ---------------------------------------------------------------------------
# Pedidos por ciclo (últimas semanas) com snapshot da regra
# ---------------------------------------------------------------------------
pedidos = []
order_seq = 1389200000000
SEMANAS = [date(2026, 11, 2), date(2026, 11, 9), date(2026, 11, 16), date(2026, 11, 23), date(2026, 11, 30)]
for a in assinaturas:
    if a["status"] == "CANCELADA":
        semanas = SEMANAS[:2]
    elif a["status"] == "PAUSADA":
        semanas = SEMANAS[:2] if a["_bairro"] == BUTANTA else SEMANAS[:3]
    else:
        semanas = SEMANAS
    if a["frequencia"] == "QUINZENAL":
        semanas = semanas[a["id"] % 2::2]
    elif a["frequencia"] == "MENSAL":
        semanas = semanas[-1:] if a["status"] == "ATIVA" else semanas[:1]
    for w in semanas:
        entrega = w + timedelta(days=a["dia_entrega"] - 1)
        geracao = entrega - timedelta(days=2)
        if geracao > HOJE:
            continue
        reg = regra_em(a["_rua"], entrega)
        snap = {"regra_id": reg["id"], "nivel": reg["nivel"], "dias": reg["_dias"],
                "vigencia_inicio": reg["vigencia_inicio"].isoformat()} if reg else None
        if entrega < HOJE:
            st = random.choices(["ENTREGUE", "CANCELADO"], [96, 4])[0]
        elif entrega == HOJE:
            st = "FATURADO"
        else:
            st = "GERADO"
        order_seq += random.randint(1, 900)
        pedidos.append(dict(id=len(pedidos) + 1, assinatura_id=a["id"], vtex_order_id=f"{order_seq}-01",
                            publicacao_vigente_id=reg["publicacao_id"] if reg else None, regra_snapshot=snap,
                            data_geracao=geracao, data_entrega_prevista=entrega, status=st))


# ---------------------------------------------------------------------------
# Análises de impacto
# ---------------------------------------------------------------------------
def proximo_dia(dia, dias_novos):
    for k in range(1, 8):
        cand = (dia - 1 + k) % 7 + 1
        if cand in dias_novos:
            return cand
    return None


def analise(p, quando, avisos):
    an = dict(id=len(analises) + 1, publicacao_id=p["id"], qtd_assinaturas=0, qtd_pulam_entrega=0,
              qtd_entrega_duplicada=0, gerada_em=quando)
    afetadas = {}
    for it in p["_itens"]:
        tipo, eid, acao = it["entidade_tipo"], it["entidade_id"], it["acao"]
        for a in assinaturas:
            if a["status"] == "CANCELADA" or a["id"] in afetadas:
                continue
            rua = rua_by_id[a["_rua"]]
            alvo = ((tipo == "RUA" and rua["id"] == eid) or
                    (tipo == "BAIRRO" and rua["bairro_id"] == eid and (rua["segue_regra_bairro"] or acao != "DIAS")) or
                    (tipo == "CIDADE" and bairro_by_id[rua["bairro_id"]]["cidade_id"] == eid))
            if not alvo:
                continue
            if acao == "INATIVAR":
                afetadas[a["id"]] = ("PULA", a["dia_entrega"], None)
            elif acao == "DIAS":
                antes, depois = it["valor_anterior"]["dias"], it["valor_novo"]["dias"]
                # dia atual da assinatura (para análises passadas, reconstrói o dia antigo)
                dia_ant = a["dia_entrega"]
                if dia_ant in depois and p["status"] != "REVISAO":
                    if random.random() < 0.35 and set(antes) - set(depois):
                        dia_ant = random.choice(sorted(set(antes) - set(depois)))
                    else:
                        continue
                if dia_ant in depois:
                    continue
                novo = proximo_dia(dia_ant, depois)
                r_ = random.random()
                t = "PULA" if r_ < 0.2 else ("DUPLICA" if r_ < 0.32 else "MUDA_DIA")
                afetadas[a["id"]] = (t, dia_ant, novo)
    for aid, (t, ant, novo) in afetadas.items():
        impactos.append(dict(id=len(impactos) + 1, analise_id=an["id"], assinatura_id=aid, tipo=t,
                             dia_anterior=ant, dia_novo=novo, status_aviso=random.choices(*avisos)[0]))
    an["qtd_assinaturas"] = len(afetadas)
    an["qtd_pulam_entrega"] = sum(1 for v in afetadas.values() if v[0] == "PULA")
    an["qtd_entrega_duplicada"] = sum(1 for v in afetadas.values() if v[0] == "DUPLICA")
    analises.append(an)


PASSADO = (["AVISADO", "ACEITO"], [40, 60])
analise(p40, ts(date(2026, 11, 5), 11, 2), PASSADO)
analise(p41, ts(date(2026, 11, 12), 13, 42), PASSADO)
analise(p42, ts(date(2026, 11, 18), 9, 32), PASSADO)
analise(p43, ts(date(2026, 11, 24), 9, 52), PASSADO)
analise(p44, ts(HOJE, 9, 41), (["PENDENTE", "AVISADO", "ACEITO"], [60, 30, 10]))

# ---------------------------------------------------------------------------
# Sincronizações (base local ← VTEX)
# ---------------------------------------------------------------------------
sincs = [dict(id=1, usuario_email=ANA, tipo="CARGA_INICIAL", origem="VTEX", status="OK",
              registros_lidos=len(clientes) + len(assinaturas) + len(ruas), erro=None,
              iniciada_em=ts(date(2026, 10, 28), 14, 0), finalizada_em=ts(date(2026, 10, 28), 14, 23))]
dia = date(2026, 10, 29)
while dia <= HOJE:
    falha = dia == date(2026, 11, 20)
    ini = ts(dia, 6, 0)
    sincs.append(dict(id=len(sincs) + 1, usuario_email=None, tipo="AUTOMATICA", origem="VTEX",
                      status="FALHA" if falha else "OK",
                      registros_lidos=0 if falha else len(assinaturas) - random.randint(0, 15),
                      erro="Timeout na API de Subscriptions da VTEX (504)" if falha else None,
                      iniciada_em=ini, finalizada_em=ini + timedelta(minutes=2 if falha else random.randint(3, 6))))
    if dia == date(2026, 11, 25):
        m = ts(dia, 14, 10)
        sincs.append(dict(id=len(sincs) + 1, usuario_email=CARLOS, tipo="MANUAL", origem="VTEX", status="OK",
                          registros_lidos=len(ruas), erro=None, iniciada_em=m, finalizada_em=m + timedelta(minutes=4)))
    dia += timedelta(days=1)

# ---------------------------------------------------------------------------
# SQL
# ---------------------------------------------------------------------------
lines.append("""-- =============================================================================
-- Seed FICTÍCIO — Painel de Entregas (DER Iota.Hub)
-- Gerado por gen_seed.py · data de referência 27/11/2026 · dia_semana ISO (1=seg … 7=dom)
-- Reexecutável: apaga e recria todos os dados das tabelas do DER.
-- Usuários fictícios entram em allowed_users como INATIVOS (não conseguem logar).
-- Nomes, e-mails (@example.com) e telefones são inventados.
-- =============================================================================
begin;

truncate table
  public.impacto_assinatura, public.analise_impacto, public.pedido_ciclo, public.assinatura,
  public.endereco, public.cliente, public.sincronizacao, public.publicacao_envio,
  public.publicacao_item, public.rascunho_alteracao, public.regra_entrega_dia, public.regra_entrega,
  public.publicacao, public.rua, public.bairro, public.zona, public.cidade, public.estado
restart identity cascade;
""")
lines.append("insert into public.allowed_users (email, full_name, role, active) values\n  " + ",\n  ".join(
    f"({q(e)}, {q(n)}, {q(r)}, false)" for e, n, r in USERS) + "\non conflict (email) do nothing;")

clean = lambda rows: [{k: v for k, v in r.items() if not k.startswith("_")} for r in rows]
insert("estado", ["id", "nome", "sigla", "status", "atualizado_em"], estados)
insert("cidade", ["id", "estado_id", "nome", "codigo_ibge", "status", "vtex_ref"], cidades)
insert("zona", ["id", "cidade_id", "nome"], zonas)
insert("bairro", ["id", "cidade_id", "zona_id", "nome", "status", "vtex_ref"], bairros)
insert("rua", ["id", "bairro_id", "logradouro", "cep", "status", "segue_regra_bairro", "vtex_ref"], ruas)
insert("publicacao", ["id", "autor_email", "publicacao_origem_id", "status", "tipo", "payload", "total_itens",
                      "criado_em", "publicado_em"], pubs)
insert("regra_entrega", ["id", "nivel", "cidade_id", "bairro_id", "rua_id", "publicacao_id", "vigencia_inicio",
                         "vigencia_fim"], regras)
insert("regra_entrega_dia", ["id", "regra_id", "dia_semana"], regra_dias)
insert("rascunho_alteracao", ["id", "usuario_email", "publicacao_id", "entidade_tipo", "entidade_id", "acao",
                              "valor_anterior", "valor_novo", "criado_em"], rascunhos)
insert("publicacao_item", ["id", "publicacao_id", "entidade_tipo", "entidade_id", "acao", "valor_anterior",
                           "valor_novo", "status_item"], itens)
insert("publicacao_envio", ["id", "publicacao_id", "tentativa", "request_payload", "http_status", "response_body",
                            "erro", "enviado_em"], envios)
insert("sincronizacao", ["id", "usuario_email", "tipo", "origem", "status", "registros_lidos", "erro",
                         "iniciada_em", "finalizada_em"], sincs)
insert("cliente", ["id", "vtex_client_id", "nome", "email", "telefone"], clientes)
insert("endereco", ["id", "cliente_id", "rua_id", "numero", "complemento", "cep"], enderecos)
insert("assinatura", ["id", "cliente_id", "endereco_id", "vtex_subscription_id", "status", "frequencia",
                      "dia_entrega", "proximo_ciclo"], assinaturas)
insert("pedido_ciclo", ["id", "assinatura_id", "vtex_order_id", "publicacao_vigente_id", "regra_snapshot",
                        "data_geracao", "data_entrega_prevista", "status"], pedidos)
insert("analise_impacto", ["id", "publicacao_id", "qtd_assinaturas", "qtd_pulam_entrega", "qtd_entrega_duplicada",
                           "gerada_em"], analises)
insert("impacto_assinatura", ["id", "analise_id", "assinatura_id", "tipo", "dia_anterior", "dia_novo",
                              "status_aviso"], impactos)

lines.append("\n-- acerta as sequences das colunas identity")
for t in ["estado", "cidade", "zona", "bairro", "rua", "publicacao", "regra_entrega", "regra_entrega_dia",
          "rascunho_alteracao", "publicacao_item", "publicacao_envio", "sincronizacao", "cliente", "endereco",
          "assinatura", "pedido_ciclo", "analise_impacto", "impacto_assinatura"]:
    lines.append(f"select setval(pg_get_serial_sequence('public.{t}', 'id'), (select coalesce(max(id), 1) from public.{t}));")
lines.append("\ncommit;\n")

import os
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print({k: len(v) for k, v in dict(estado=estados, cidade=cidades, zona=zonas, bairro=bairros, rua=ruas,
                                   publicacao=pubs, regra=regras, regra_dia=regra_dias, rascunho=rascunhos,
                                   item=itens, envio=envios, sinc=sincs, cliente=clientes, endereco=enderecos,
                                   assinatura=assinaturas, pedido=pedidos, analise=analises,
                                   impacto=impactos).items()})
print("analises:", [(a["publicacao_id"], a["qtd_assinaturas"], a["qtd_pulam_entrega"], a["qtd_entrega_duplicada"]) for a in analises])
