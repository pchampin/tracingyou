#!/usr/bin/env python
"""
This script aims at updating a model with the obsel/attribute types used
in a particular config.json .

usage: config2model.py [config_file] [model_url]
"""
import json
import rdflib
import sys

RDF = rdflib.RDF
RDFS = rdflib.RDFS

K = rdflib.Namespace("http://liris.cnrs.fr/silex/2009/ktbs#")
BUILTIN_PROP = {'@type', 'begin', 'end'}

config = sys.argv[1]
model = sys.argv[2]

with open(config) as f:
    config_data = json.load(f)

model_iri = rdflib.URIRef(model)
model_graph = rdflib.Graph(identifier=model_iri)
format = 'turtle'  # TODO infer format more robustly
model_graph.load(model_graph.identifier, format=format)

model_prefix = rdflib.URIRef(model_iri)
if model_prefix[-1] not in '#/':
    model_prefix += '#'


comment = ""
todo_lit = rdflib.Literal("TODO")
seen = set()
for ruleset in config_data['rulesets'].values():
    for rule in ruleset:
        # handle type
        template = rule['template']
        typ = template['@type']
        if typ[:2] == 'm:':
            typ_iri = model_prefix + typ[2:]
        else:
            typ_iri = rdflib.URIRef(typ, model_iri)
        seen.add(typ_iri)
        if not (typ_iri, RDF.type, K.ObselType) in model_graph:
            model_graph.add((typ_iri, RDF.type, K.ObselType))
            model_graph.add((typ_iri, RDFS.comment, todo_lit))
            comment += "# ADDED:    obsel type  {}\n".format(typ)

        for prop in template.keys():
            if prop in BUILTIN_PROP: continue
            if prop[:2] == 'm:':
                prop_iri = model_prefix + prop[2:]
            else:
                prop_iri = rdflib.URIRef(prop, model_iri)
            if not (prop_iri, RDF.type, K.AttributeType) in model_graph:
                model_graph.add((prop_iri, RDF.type, K.AttributeType))
                model_graph.add((prop_iri, RDFS.comment, todo_lit))
                comment += "# ADDED:    attr  type  {}\n".format(prop)

for typ_iri in model_graph.subjects(RDF.type, K.ObselType):
    if (None, K.hasSuperObselType, typ_iri) in model_graph: continue
    if typ_iri not in seen:
        comment += "# NOT USED: obsel type  {}\n".format(typ_iri)

print(model_graph.serialize(format=format, base=model_iri).decode('utf8'))
if comment:
    print(comment, file=sys.stderr)
else:
    print("# nothing changed", file=sys.stderr)
