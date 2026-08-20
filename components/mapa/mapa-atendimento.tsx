"use client"

import { useEffect, useMemo, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

export type PontoCliente = {
  id: string
  nome: string
  endereco: string | null
  processos: number
  processosAbertos: number
  lat: number
  lng: number
  municipio: string
  uf: string
  origem: "manual" | "endereco"
}

/**
 * Mapa de atendimento.
 *
 * Leaflet é imperativo e cria seus próprios nós no DOM; o React não
 * pode disputar essa árvore com ele. Por isso o mapa nasce uma vez num
 * `<div>` vazio e as atualizações entram por uma camada de marcadores
 * que é limpa e redesenhada — nunca por re-render de JSX.
 *
 * Os ícones vêm de `divIcon` (HTML nosso) em vez do marcador padrão:
 * o ícone default do Leaflet aponta para PNGs dentro do pacote, e esse
 * caminho quebra quando o bundler reescreve as URLs.
 */

/** Brasília no centro: é de lá que o escritório atende. */
const CENTRO_PADRAO: [number, number] = [-15.7939, -47.8828]

function pinoHtml(total: number, abertos: number) {
  const cor = abertos > 0 ? "#b3261e" : "#1e3a5f"
  const rotulo = total > 1 ? String(total) : ""

  return `
    <div style="position:relative;display:flex;align-items:center;justify-content:center;width:28px;height:36px;">
      <svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 35C14 35 26 21.5 26 13A12 12 0 1 0 2 13c0 8.5 12 22 12 22Z"
              fill="${cor}" stroke="#ffffff" stroke-width="2"/>
      </svg>
      <span style="position:absolute;top:5px;left:0;right:0;text-align:center;color:#fff;font:700 11px/1 system-ui,sans-serif;">${rotulo}</span>
    </div>
  `
}

type Grupo = {
  chave: string
  municipio: string
  uf: string
  lat: number
  lng: number
  clientes: PontoCliente[]
}

export function MapaAtendimento({
  clientes,
  aoSelecionarMunicipio,
}: {
  clientes: PontoCliente[]
  aoSelecionarMunicipio?: (chave: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapaRef = useRef<L.Map | null>(null)
  const camadaRef = useRef<L.LayerGroup | null>(null)

  // Dois clientes na mesma cidade viram um pin com contagem: cinquenta
  // marcadores empilhados no mesmo ponto não dizem nada.
  const grupos = useMemo(() => {
    const mapa = new Map<string, Grupo>()

    for (const c of clientes) {
      const chave = `${c.municipio}/${c.uf}|${c.lat.toFixed(4)},${c.lng.toFixed(4)}`
      const grupo = mapa.get(chave)

      if (grupo) {
        grupo.clientes.push(c)
      } else {
        mapa.set(chave, {
          chave,
          municipio: c.municipio,
          uf: c.uf,
          lat: c.lat,
          lng: c.lng,
          clientes: [c],
        })
      }
    }

    return [...mapa.values()]
  }, [clientes])

  useEffect(() => {
    if (mapaRef.current || !containerRef.current) return

    const mapa = L.map(containerRef.current, {
      center: CENTRO_PADRAO,
      zoom: 9,
      scrollWheelZoom: false,
    })

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa)

    // A roda da página rola a página; o mapa só captura a roda depois
    // de um clique nele. Sem isso, rolar a tela vira zoom por acidente.
    mapa.on("click", () => mapa.scrollWheelZoom.enable())
    mapa.on("mouseout", () => mapa.scrollWheelZoom.disable())

    camadaRef.current = L.layerGroup().addTo(mapa)
    mapaRef.current = mapa

    return () => {
      mapa.remove()
      mapaRef.current = null
      camadaRef.current = null
    }
  }, [])

  useEffect(() => {
    const mapa = mapaRef.current
    const camada = camadaRef.current
    if (!mapa || !camada) return

    camada.clearLayers()

    for (const grupo of grupos) {
      const abertos = grupo.clientes.reduce((t, c) => t + c.processosAbertos, 0)

      const marcador = L.marker([grupo.lat, grupo.lng], {
        icon: L.divIcon({
          html: pinoHtml(grupo.clientes.length, abertos),
          className: "",
          iconSize: [28, 36],
          iconAnchor: [14, 35],
          popupAnchor: [0, -32],
        }),
        title: `${grupo.municipio}${grupo.uf ? `/${grupo.uf}` : ""}`,
      })

      const lista = grupo.clientes
        .slice(0, 8)
        .map(
          (c) =>
            `<li style="margin:2px 0"><a href="/clientes/${c.id}" style="color:#1e3a5f;text-decoration:underline">${c.nome}</a>${
              c.processosAbertos > 0
                ? ` <span style="color:#b3261e">(${c.processosAbertos} em aberto)</span>`
                : ""
            }</li>`
        )
        .join("")

      const resto =
        grupo.clientes.length > 8
          ? `<li style="color:#6b7783">e mais ${grupo.clientes.length - 8}…</li>`
          : ""

      marcador.bindPopup(
        `<div style="font:400 12px/1.4 system-ui,sans-serif;min-width:170px">
           <strong style="font-size:13px">${grupo.municipio}${grupo.uf ? `/${grupo.uf}` : ""}</strong>
           <div style="color:#6b7783;margin-bottom:4px">${grupo.clientes.length} cliente(s) · ${abertos} processo(s) em aberto</div>
           <ul style="margin:0;padding-left:16px">${lista}${resto}</ul>
         </div>`
      )

      if (aoSelecionarMunicipio) {
        marcador.on("popupopen", () => aoSelecionarMunicipio(grupo.chave))
      }

      marcador.addTo(camada)
    }

    // O enquadramento segue os dados: com um cliente só, centraliza
    // nele; com vários, abre no retângulo que contém todos.
    if (grupos.length === 1) {
      mapa.setView([grupos[0].lat, grupos[0].lng], 11)
    } else if (grupos.length > 1) {
      mapa.fitBounds(
        L.latLngBounds(grupos.map((g) => [g.lat, g.lng] as [number, number])),
        { padding: [40, 40], maxZoom: 12 }
      )
    }
  }, [grupos, aoSelecionarMunicipio])

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Mapa de atendimento"
      className="h-[420px] w-full overflow-hidden rounded-xl ring-1 ring-foreground/10 ring-inset lg:h-[540px]"
    />
  )
}
