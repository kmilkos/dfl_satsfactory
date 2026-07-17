import React, { useState, useEffect, useMemo } from "react";
import { 
  Boxes, Cpu, Zap, Play, Pause, Activity, Info, Layers, 
  TrendingUp, Gauge, ArrowRight, Database, AlertCircle, CheckCircle 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { TelemetryData, ItemThroughput } from "../types";

interface MachineSeriesDiagramProps {
  telemetry: TelemetryData;
  isLoading?: boolean;
}

// Machine node interface
interface DiagramNode {
  id: string;
  name: string;
  machineType: "Miner" | "Smelter" | "Foundry" | "Constructor" | "Assembler" | "Storage" | "SubInput";
  x: number;
  y: number;
  inputItem?: string | string[];
  outputItem?: string;
  standardInputRate?: number | number[]; // per minute
  standardOutputRate?: number; // per minute
  powerMw: number;
}

// Conveyor connection interface
interface ConveyorConnection {
  fromNodeId: string;
  toNodeId: string;
  item: string;
  inputPortIndex?: number; // for machines with multiple inputs
}

// Production chain specification
interface ProductionChain {
  id: string;
  name: string;
  category: "Iron" | "Copper" | "Steel" | "Advanced" | "Basic";
  description: string;
  nodes: DiagramNode[];
  connections: ConveyorConnection[];
  targetItem: string;
}

// -----------------------------------------------------------------------------
// PRODUCTION CHAINS CONFIGURATION
// -----------------------------------------------------------------------------
const PRODUCTION_CHAINS: ProductionChain[] = [
  {
    id: "iron-plate",
    name: "Iron Plate Production Line",
    category: "Iron",
    description: "Basic industrial structure translating raw Iron Ore into structural Iron Plates.",
    targetItem: "Iron Plate",
    nodes: [
      { id: "miner", name: "Iron Miner Mk.1", machineType: "Miner", x: 80, y: 180, outputItem: "Iron Ore", standardOutputRate: 60, powerMw: 5 },
      { id: "smelter", name: "Iron Smelter", machineType: "Smelter", x: 360, y: 180, inputItem: "Iron Ore", outputItem: "Iron Ingot", standardInputRate: 30, standardOutputRate: 30, powerMw: 4 },
      { id: "constructor", name: "Constructor", machineType: "Constructor", x: 640, y: 180, inputItem: "Iron Ingot", outputItem: "Iron Plate", standardInputRate: 30, standardOutputRate: 20, powerMw: 4 },
      { id: "storage", name: "Ficsit Storage", machineType: "Storage", x: 920, y: 180, inputItem: "Iron Plate", powerMw: 0 }
    ],
    connections: [
      { fromNodeId: "miner", toNodeId: "smelter", item: "Iron Ore" },
      { fromNodeId: "smelter", toNodeId: "constructor", item: "Iron Ingot" },
      { fromNodeId: "constructor", toNodeId: "storage", item: "Iron Plate" }
    ]
  },
  {
    id: "iron-rod-screws",
    name: "Screws Manufacturing Series",
    category: "Iron",
    description: "Multi-stage manufacturing line for high-density Screw output from basic Iron Rods.",
    targetItem: "Screws",
    nodes: [
      { id: "miner", name: "Iron Miner Mk.1", machineType: "Miner", x: 60, y: 180, outputItem: "Iron Ore", standardOutputRate: 60, powerMw: 5 },
      { id: "smelter", name: "Iron Smelter", machineType: "Smelter", x: 300, y: 180, inputItem: "Iron Ore", outputItem: "Iron Ingot", standardInputRate: 30, standardOutputRate: 30, powerMw: 4 },
      { id: "constructor-rod", name: "Rod Constructor", machineType: "Constructor", x: 540, y: 180, inputItem: "Iron Ingot", outputItem: "Iron Rod", standardInputRate: 15, standardOutputRate: 15, powerMw: 4 },
      { id: "constructor-screw", name: "Screw Constructor", machineType: "Constructor", x: 780, y: 180, inputItem: "Iron Rod", outputItem: "Screws", standardInputRate: 10, standardOutputRate: 40, powerMw: 4 },
      { id: "storage", name: "Storage Container", machineType: "Storage", x: 1020, y: 180, inputItem: "Screws", powerMw: 0 }
    ],
    connections: [
      { fromNodeId: "miner", toNodeId: "smelter", item: "Iron Ore" },
      { fromNodeId: "smelter", toNodeId: "constructor-rod", item: "Iron Ingot" },
      { fromNodeId: "constructor-rod", toNodeId: "constructor-screw", item: "Iron Rod" },
      { fromNodeId: "constructor-screw", toNodeId: "storage", item: "Screws" }
    ]
  },
  {
    id: "reinforced-plate",
    name: "Reinforced Iron Plate Assembly",
    category: "Iron",
    description: "Branching assembly network merging Iron Plate lines with high-volume Screws.",
    targetItem: "Reinforced Iron Plate",
    nodes: [
      // Top Branch (Plate)
      { id: "miner-1", name: "Iron Miner (Plate)", machineType: "Miner", x: 80, y: 80, outputItem: "Iron Ore", standardOutputRate: 60, powerMw: 5 },
      { id: "smelter-1", name: "Smelter (Plate)", machineType: "Smelter", x: 300, y: 80, inputItem: "Iron Ore", outputItem: "Iron Ingot", standardInputRate: 30, standardOutputRate: 30, powerMw: 4 },
      { id: "constructor-plate", name: "Plate Constructor", machineType: "Constructor", x: 520, y: 80, inputItem: "Iron Ingot", outputItem: "Iron Plate", standardInputRate: 30, standardOutputRate: 20, powerMw: 4 },
      
      // Bottom Branch (Screw)
      { id: "miner-2", name: "Iron Miner (Screw)", machineType: "Miner", x: 80, y: 310, outputItem: "Iron Ore", standardOutputRate: 60, powerMw: 5 },
      { id: "smelter-2", name: "Smelter (Screw)", machineType: "Smelter", x: 260, y: 310, inputItem: "Iron Ore", outputItem: "Iron Ingot", standardInputRate: 30, standardOutputRate: 30, powerMw: 4 },
      { id: "constructor-rod", name: "Rod Constructor", machineType: "Constructor", x: 440, y: 310, inputItem: "Iron Ingot", outputItem: "Iron Rod", standardInputRate: 15, standardOutputRate: 15, powerMw: 4 },
      { id: "constructor-screw", name: "Screw Constructor", machineType: "Constructor", x: 620, y: 310, inputItem: "Iron Rod", outputItem: "Screws", standardInputRate: 10, standardOutputRate: 40, powerMw: 4 },
      
      // Merge / Assembler
      { id: "assembler-rip", name: "Assembler (RIP)", machineType: "Assembler", x: 810, y: 195, inputItem: ["Iron Plate", "Screws"], outputItem: "Reinforced Iron Plate", standardInputRate: [30, 60], standardOutputRate: 5, powerMw: 15 },
      { id: "storage", name: "Assembly Storage", machineType: "Storage", x: 1020, y: 195, inputItem: "Reinforced Iron Plate", powerMw: 0 }
    ],
    connections: [
      { fromNodeId: "miner-1", toNodeId: "smelter-1", item: "Iron Ore" },
      { fromNodeId: "smelter-1", toNodeId: "constructor-plate", item: "Iron Ingot" },
      { fromNodeId: "constructor-plate", toNodeId: "assembler-rip", item: "Iron Plate", inputPortIndex: 0 },
      
      { fromNodeId: "miner-2", toNodeId: "smelter-2", item: "Iron Ore" },
      { fromNodeId: "smelter-2", toNodeId: "constructor-rod", item: "Iron Ingot" },
      { fromNodeId: "constructor-rod", toNodeId: "constructor-screw", item: "Iron Rod" },
      { fromNodeId: "constructor-screw", toNodeId: "assembler-rip", item: "Screws", inputPortIndex: 1 },
      
      { fromNodeId: "assembler-rip", toNodeId: "storage", item: "Reinforced Iron Plate" }
    ]
  },
  {
    id: "cable-series",
    name: "Wire & Cable Processing Line",
    category: "Copper",
    description: "Linear copper processing series turning Copper Ore into electrical components.",
    targetItem: "Cable",
    nodes: [
      { id: "miner", name: "Copper Miner Mk.1", machineType: "Miner", x: 80, y: 180, outputItem: "Copper Ore", standardOutputRate: 60, powerMw: 5 },
      { id: "smelter", name: "Copper Smelter", machineType: "Smelter", x: 360, y: 180, inputItem: "Copper Ore", outputItem: "Copper Ingot", standardInputRate: 30, standardOutputRate: 30, powerMw: 4 },
      { id: "constructor-wire", name: "Wire Constructor", machineType: "Constructor", x: 640, y: 180, inputItem: "Copper Ingot", outputItem: "Wire", standardInputRate: 15, standardOutputRate: 30, powerMw: 4 },
      { id: "constructor-cable", name: "Cable Constructor", machineType: "Constructor", x: 920, y: 180, inputItem: "Wire", outputItem: "Cable", standardInputRate: 60, standardOutputRate: 30, powerMw: 4 },
      { id: "storage", name: "Terminal Storage", machineType: "Storage", x: 1150, y: 180, inputItem: "Cable", powerMw: 0 }
    ],
    connections: [
      { fromNodeId: "miner", toNodeId: "smelter", item: "Copper Ore" },
      { fromNodeId: "smelter", toNodeId: "constructor-wire", item: "Copper Ingot" },
      { fromNodeId: "constructor-wire", toNodeId: "constructor-cable", item: "Wire" },
      { fromNodeId: "constructor-cable", toNodeId: "storage", item: "Cable" }
    ]
  },
  {
    id: "copper-sheet",
    name: "Copper Sheet Manufacturing",
    category: "Copper",
    description: "Simple sheet manufacturing line utilizing copper ingots.",
    targetItem: "Copper Sheet",
    nodes: [
      { id: "miner", name: "Copper Miner Mk.1", machineType: "Miner", x: 80, y: 180, outputItem: "Copper Ore", standardOutputRate: 60, powerMw: 5 },
      { id: "smelter", name: "Copper Smelter", machineType: "Smelter", x: 360, y: 180, inputItem: "Copper Ore", outputItem: "Copper Ingot", standardInputRate: 30, standardOutputRate: 30, powerMw: 4 },
      { id: "constructor", name: "Sheet Constructor", machineType: "Constructor", x: 640, y: 180, inputItem: "Copper Ingot", outputItem: "Copper Sheet", standardInputRate: 20, standardOutputRate: 10, powerMw: 4 },
      { id: "storage", name: "Sheet Storage", machineType: "Storage", x: 920, y: 180, inputItem: "Copper Sheet", powerMw: 0 }
    ],
    connections: [
      { fromNodeId: "miner", toNodeId: "smelter", item: "Copper Ore" },
      { fromNodeId: "smelter", toNodeId: "constructor", item: "Copper Ingot" },
      { fromNodeId: "constructor", toNodeId: "storage", item: "Copper Sheet" }
    ]
  },
  {
    id: "steel-foundry",
    name: "Steel Foundry & Beam Line",
    category: "Steel",
    description: "Advanced Foundry layout mixing Coal with Iron Ore to produce heavy industrial Steel Beams.",
    targetItem: "Steel Beam",
    nodes: [
      { id: "iron-miner", name: "Iron Miner Mk.1", machineType: "Miner", x: 80, y: 90, outputItem: "Iron Ore", standardOutputRate: 60, powerMw: 5 },
      { id: "coal-miner", name: "Coal Miner Mk.1", machineType: "Miner", x: 80, y: 270, outputItem: "Coal", standardOutputRate: 60, powerMw: 5 },
      { id: "foundry", name: "Steel Foundry", machineType: "Foundry", x: 380, y: 180, inputItem: ["Iron Ore", "Coal"], outputItem: "Steel Ingot", standardInputRate: [45, 45], standardOutputRate: 45, powerMw: 16 },
      { id: "constructor", name: "Beam Constructor", machineType: "Constructor", x: 680, y: 180, inputItem: "Steel Ingot", outputItem: "Steel Beam", standardInputRate: 60, standardOutputRate: 15, powerMw: 4 },
      { id: "storage", name: "Steel Storage", machineType: "Storage", x: 960, y: 180, inputItem: "Steel Beam", powerMw: 0 }
    ],
    connections: [
      { fromNodeId: "iron-miner", toNodeId: "foundry", item: "Iron Ore", inputPortIndex: 0 },
      { fromNodeId: "coal-miner", toNodeId: "foundry", item: "Coal", inputPortIndex: 1 },
      { fromNodeId: "foundry", toNodeId: "constructor", item: "Steel Ingot" },
      { fromNodeId: "constructor", toNodeId: "storage", item: "Steel Beam" }
    ]
  },
  {
    id: "rotor-assembly",
    name: "Rotor Fabrication Line",
    category: "Advanced",
    description: "Sub-assembly line manufacturing Rotors from high-speed Screws and Iron Rods.",
    targetItem: "Rotor",
    nodes: [
      { id: "rod-input", name: "Iron Rod Source", machineType: "SubInput", x: 100, y: 90, outputItem: "Iron Rod", standardOutputRate: 20, powerMw: 0 },
      { id: "screw-input", name: "Screws Source", machineType: "SubInput", x: 100, y: 270, outputItem: "Screws", standardOutputRate: 100, powerMw: 0 },
      { id: "assembler", name: "Rotor Assembler", machineType: "Assembler", x: 420, y: 180, inputItem: ["Iron Rod", "Screws"], outputItem: "Rotor", standardInputRate: [20, 100], standardOutputRate: 4, powerMw: 15 },
      { id: "storage", name: "Rotor Storage", machineType: "Storage", x: 740, y: 180, inputItem: "Rotor", powerMw: 0 }
    ],
    connections: [
      { fromNodeId: "rod-input", toNodeId: "assembler", item: "Iron Rod", inputPortIndex: 0 },
      { fromNodeId: "screw-input", toNodeId: "assembler", item: "Screws", inputPortIndex: 1 },
      { fromNodeId: "assembler", toNodeId: "storage", item: "Rotor" }
    ]
  },
  {
    id: "smart-plating",
    name: "Smart Plating Space Assembly",
    category: "Advanced",
    description: "Project Assembly line coupling Reinforced Iron Plates with Rotors to craft orbital cargo payloads.",
    targetItem: "Smart Plating",
    nodes: [
      { id: "rip-input", name: "Reinforced Plate Feed", machineType: "SubInput", x: 100, y: 90, outputItem: "Reinforced Iron Plate", standardOutputRate: 2, powerMw: 0 },
      { id: "rotor-input", name: "Rotor Feed System", machineType: "SubInput", x: 100, y: 270, outputItem: "Rotor", standardOutputRate: 2, powerMw: 0 },
      { id: "assembler", name: "Smart Plating Assembler", machineType: "Assembler", x: 420, y: 180, inputItem: ["Reinforced Iron Plate", "Rotor"], outputItem: "Smart Plating", standardInputRate: [2, 2], standardOutputRate: 2, powerMw: 15 },
      { id: "storage", name: "Space Dock Storage", machineType: "Storage", x: 740, y: 180, inputItem: "Smart Plating", powerMw: 0 }
    ],
    connections: [
      { fromNodeId: "rip-input", toNodeId: "assembler", item: "Reinforced Iron Plate", inputPortIndex: 0 },
      { fromNodeId: "rotor-input", toNodeId: "assembler", item: "Rotor", inputPortIndex: 1 },
      { fromNodeId: "assembler", toNodeId: "storage", item: "Smart Plating" }
    ]
  },
  {
    id: "concrete-line",
    name: "Concrete Solidification Line",
    category: "Basic",
    description: "Single-material pulverization line turning raw Limestone deposits into structural Concrete.",
    targetItem: "Concrete",
    nodes: [
      { id: "miner", name: "Limestone Miner Mk.1", machineType: "Miner", x: 80, y: 180, outputItem: "Limestone", standardOutputRate: 60, powerMw: 5 },
      { id: "constructor", name: "Concrete Constructor", machineType: "Constructor", x: 420, y: 180, inputItem: "Limestone", outputItem: "Concrete", standardInputRate: 45, standardOutputRate: 15, powerMw: 4 },
      { id: "storage", name: "Silo Storage", machineType: "Storage", x: 760, y: 180, inputItem: "Concrete", powerMw: 0 }
    ],
    connections: [
      { fromNodeId: "miner", toNodeId: "constructor", item: "Limestone" },
      { fromNodeId: "constructor", toNodeId: "storage", item: "Concrete" }
    ]
  }
];

// Simulated active rates when live rates are 0 or user toggles simulation
const SIMULATED_RATES: Record<string, { productionRate: number; consumptionRate: number }> = {
  "Iron Ore": { productionRate: 60.0, consumptionRate: 60.0 },
  "Iron Ingot": { productionRate: 60.0, consumptionRate: 45.0 },
  "Iron Plate": { productionRate: 20.0, consumptionRate: 15.0 },
  "Iron Rod": { productionRate: 15.0, consumptionRate: 10.0 },
  "Screws": { productionRate: 40.0, consumptionRate: 35.0 },
  "Reinforced Iron Plate": { productionRate: 5.0, consumptionRate: 2.0 },
  "Copper Ore": { productionRate: 60.0, consumptionRate: 60.0 },
  "Copper Ingot": { productionRate: 60.0, consumptionRate: 45.0 },
  "Wire": { productionRate: 60.0, consumptionRate: 60.0 },
  "Cable": { productionRate: 30.0, consumptionRate: 12.0 },
  "Copper Sheet": { productionRate: 10.0, consumptionRate: 5.0 },
  "Coal": { productionRate: 60.0, consumptionRate: 45.0 },
  "Steel Ingot": { productionRate: 45.0, consumptionRate: 30.0 },
  "Steel Beam": { productionRate: 15.0, consumptionRate: 8.0 },
  "Rotor": { productionRate: 4.0, consumptionRate: 2.0 },
  "Smart Plating": { productionRate: 2.0, consumptionRate: 0.0 },
  "Limestone": { productionRate: 60.0, consumptionRate: 45.0 },
  "Concrete": { productionRate: 15.0, consumptionRate: 8.0 }
};

export default function MachineSeriesDiagram({ telemetry, isLoading }: MachineSeriesDiagramProps) {
  const [selectedChainId, setSelectedChainId] = useState<string>("iron-plate");
  const [isSimulatedMode, setIsSimulatedMode] = useState<boolean>(true); // default true for better visual showcase
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Auto-switch simulated mode to false if telemetry actually starts streaming non-zero values
  useEffect(() => {
    const hasActiveProduction = telemetry.throughput.some(item => item.productionRate > 0 || item.consumptionRate > 0);
    if (hasActiveProduction) {
      setIsSimulatedMode(false);
    }
  }, [telemetry.throughput]);

  // Find the selected chain
  const activeChain = useMemo(() => {
    return PRODUCTION_CHAINS.find(c => c.id === selectedChainId) || PRODUCTION_CHAINS[0];
  }, [selectedChainId]);

  // Map item names to rates (either live or simulated)
  const ratesMap = useMemo(() => {
    const map: Record<string, { productionRate: number; consumptionRate: number; currentRate: number }> = {};
    
    // Initialize standard values
    activeChain.nodes.forEach(node => {
      if (node.outputItem) {
        map[node.outputItem] = { productionRate: 0, consumptionRate: 0, currentRate: 0 };
      }
    });

    if (isSimulatedMode) {
      // Use mock values
      Object.entries(SIMULATED_RATES).forEach(([name, val]) => {
        map[name] = {
          productionRate: val.productionRate,
          consumptionRate: val.consumptionRate,
          currentRate: val.productionRate - val.consumptionRate
        };
      });
    } else {
      // Use actual telemetry data
      telemetry.throughput.forEach((item) => {
        map[item.name] = {
          productionRate: item.productionRate,
          consumptionRate: item.consumptionRate,
          currentRate: item.currentRate
        };
      });
    }

    return map;
  }, [activeChain, isSimulatedMode, telemetry.throughput]);

  // Handle auto selecting first node on chain change
  useEffect(() => {
    if (activeChain.nodes.length > 0) {
      setSelectedNodeId(activeChain.nodes[0].id);
    }
  }, [selectedChainId, activeChain]);

  // Dimensions of a node card
  const nodeWidth = 180;
  const nodeHeight = 90;

  // Bezier curve connector path generator
  const getBezierPath = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = Math.abs(x2 - x1) * 0.45;
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  };

  // Get coordinate locations for ports
  const getOutputPortCoords = (node: DiagramNode) => {
    return {
      x: node.x + nodeWidth,
      y: node.y + (nodeHeight / 2)
    };
  };

  const getInputPortCoords = (node: DiagramNode, portIndex: number = 0, totalPorts: number = 1) => {
    if (totalPorts === 1) {
      return {
        x: node.x,
        y: node.y + (nodeHeight / 2)
      };
    } else {
      // Distribute ports vertically
      // Index 0: upper port, Index 1: lower port
      const offset = portIndex === 0 ? 30 : 60;
      return {
        x: node.x,
        y: node.y + offset
      };
    }
  };

  // Get current active rate for a connection
  const getConnectionRate = (conn: ConveyorConnection) => {
    const itemRates = ratesMap[conn.item];
    if (!itemRates) return 0;
    
    // Find output node to see its type
    const fromNode = activeChain.nodes.find(n => n.id === conn.fromNodeId);
    if (!fromNode) return 0;

    // Use output item rate
    return itemRates.productionRate;
  };

  // Find currently selected node details
  const selectedNode = useMemo(() => {
    return activeChain.nodes.find(n => n.id === selectedNodeId) || null;
  }, [activeChain, selectedNodeId]);

  // Calculate efficiency of the selected node
  const selectedNodeStats = useMemo(() => {
    if (!selectedNode) return null;

    let currentRate = 0;
    let targetRate = 0;
    let itemName = "";

    if (selectedNode.outputItem) {
      itemName = selectedNode.outputItem;
      const rateObj = ratesMap[itemName];
      currentRate = rateObj ? rateObj.productionRate : 0;
      targetRate = selectedNode.standardOutputRate || 0;
    } else if (selectedNode.inputItem) {
      const inp = Array.isArray(selectedNode.inputItem) ? selectedNode.inputItem[0] : selectedNode.inputItem;
      itemName = inp;
      const rateObj = ratesMap[inp];
      currentRate = rateObj ? rateObj.consumptionRate : 0;
      const targetRateArr = selectedNode.standardInputRate;
      targetRate = Array.isArray(targetRateArr) ? targetRateArr[0] : (targetRateArr || 0);
    }

    const efficiency = targetRate > 0 ? Math.min(100, (currentRate / targetRate) * 100) : 100;
    const powerUsed = currentRate > 0 ? selectedNode.powerMw : 0;

    return {
      efficiency,
      currentRate,
      targetRate,
      itemName,
      powerUsed
    };
  }, [selectedNode, ratesMap]);

  return (
    <div className="w-full h-full text-slate-100 flex flex-col">
      
      {/* 1. Header Navigation Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 p-6 pb-4 shrink-0">
        <div>
          <h1 className="text-xl font-mono text-orange-500 uppercase tracking-wider font-bold flex items-center">
            <Boxes className="w-5 h-5 mr-2 text-orange-500 animate-bounce-subtle" />
            Machine Flows & Conveyor Matrix
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Dynamic wiring schemas mapping resource loops, conveyor belt speeds and machine couplings
          </p>
        </div>

        {/* Live vs Simulation Toggles */}
        <div className="flex items-center space-x-3 mt-3 md:mt-0 bg-zinc-950 border border-slate-800 px-3 py-1.5 rounded text-xs font-mono">
          <div className="flex items-center space-x-1.5 mr-2 border-r border-slate-800 pr-3">
            <span className={`w-1.5 h-1.5 rounded-full ${isSimulatedMode ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 animate-ping'}`}></span>
            <span className="text-[10px] text-slate-400">FEED:</span>
            <span className={`font-bold ${isSimulatedMode ? 'text-amber-400' : 'text-emerald-400'}`}>
              {isSimulatedMode ? "SIMULATOR LOAD" : "LIVE TELEMETRY"}
            </span>
          </div>

          <div className="flex bg-zinc-900 border border-slate-800 rounded overflow-hidden">
            <button
              onClick={() => setIsSimulatedMode(false)}
              className={`px-2.5 py-1 text-[9px] font-bold transition-all cursor-pointer ${
                !isSimulatedMode 
                  ? "bg-emerald-500 text-zinc-950" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              LIVE
            </button>
            <button
              onClick={() => setIsSimulatedMode(true)}
              className={`px-2.5 py-1 text-[9px] font-bold transition-all cursor-pointer ${
                isSimulatedMode 
                  ? "bg-amber-500 text-zinc-950" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              SIMULATE
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Interface Split Layout */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        
        {/* Left Side: Category Selector & Schema Canvas */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-slate-900 overflow-hidden">
          
          {/* Quick filter tabs */}
          <div className="bg-zinc-950/40 border-b border-slate-900 px-6 py-2.5 flex flex-wrap gap-2 shrink-0">
            {PRODUCTION_CHAINS.map((chain) => {
              const active = chain.id === selectedChainId;
              const hasRate = (ratesMap[chain.targetItem]?.productionRate || 0) > 0;
              return (
                <button
                  key={chain.id}
                  onClick={() => setSelectedChainId(chain.id)}
                  className={`px-3 py-1.5 rounded font-mono text-[10px] font-bold tracking-tight border uppercase transition-all cursor-pointer ${
                    active
                      ? "bg-orange-500/10 text-orange-500 border-orange-500"
                      : "bg-zinc-900/50 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700"
                  }`}
                >
                  <span className="flex items-center">
                    {chain.name}
                    {!isSimulatedMode && hasRate && (
                      <span className="w-1 h-1 bg-emerald-400 rounded-full ml-1.5 animate-ping"></span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Warning Banner for zero rate live telemetry */}
          {!isSimulatedMode && ratesMap[activeChain.targetItem]?.productionRate === 0 && (
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 flex items-center justify-between text-left shrink-0">
              <span className="text-[10px] font-mono text-amber-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                Live conveyor feeds for "{activeChain.targetItem}" are currently idle. Toggle 'SIMULATE' to check full wiring animations.
              </span>
              <button 
                onClick={() => setIsSimulatedMode(true)}
                className="text-[9px] font-mono font-bold text-amber-400 hover:underline cursor-pointer"
              >
                ENABLE SIMULATOR
              </button>
            </div>
          )}

          {/* Schema Description block */}
          <div className="px-6 py-3 bg-zinc-900/10 border-b border-slate-900 flex justify-between items-center text-left shrink-0">
            <div>
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Selected Assembly Schematic</span>
              <h2 className="text-xs font-mono font-semibold text-slate-300 mt-0.5">{activeChain.description}</h2>
            </div>
            <span className="text-[9px] font-mono text-orange-500 bg-orange-500/5 border border-orange-500/10 px-2 py-0.5 rounded font-bold uppercase">
              {activeChain.category} Class
            </span>
          </div>

          {/* SVG Diagram Canvas */}
          <div className="flex-1 overflow-auto bg-zinc-950/20 relative p-6 select-none custom-scrollbar">
            
            {/* Diagram viewport box container */}
            <div className="relative" style={{ width: "1250px", height: "420px" }}>
              
              {/* SVG Connector Layer */}
              <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
                <defs>
                  {/* Arrow Head markers */}
                  <marker
                    id="arrow"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="5"
                    markerHeight="5"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#475569" />
                  </marker>
                  
                  <marker
                    id="arrow-active"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f97316" />
                  </marker>

                  {/* Flow glow filters */}
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Draw SVG Conveyor Connectors */}
                {activeChain.connections.map((conn, idx) => {
                  const fromNode = activeChain.nodes.find(n => n.id === conn.fromNodeId);
                  const toNode = activeChain.nodes.find(n => n.id === conn.toNodeId);

                  if (!fromNode || !toNode) return null;

                  const start = getOutputPortCoords(fromNode);
                  
                  // Handle multiple inputs on Assembler (RIP / Foundry / Advanced)
                  const totalInputs = activeChain.connections.filter(c => c.toNodeId === toNode.id).length;
                  const end = getInputPortCoords(toNode, conn.inputPortIndex || 0, totalInputs);

                  const path = getBezierPath(start.x, start.y, end.x, end.y);
                  const rate = getConnectionRate(conn);
                  const isActive = rate > 0;

                  return (
                    <g key={`conn-${idx}`}>
                      {/* Conveyor Belt Background Track */}
                      <path
                        d={path}
                        fill="none"
                        stroke="#1e293b"
                        strokeWidth="5"
                        strokeLinecap="round"
                      />
                      
                      {/* Flow status border outline */}
                      <path
                        d={path}
                        fill="none"
                        stroke={isActive ? "#ea580c" : "#334155"}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        markerEnd={`url(#${isActive ? "arrow-active" : "arrow"})`}
                      />

                      {/* Moving Item Flow pulses */}
                      {isActive && (
                        <g>
                          {/* Inner glowing pulse line */}
                          <path
                            d={path}
                            fill="none"
                            stroke="#fdba74"
                            strokeWidth="1.5"
                            strokeDasharray="8 16"
                            className="conveyor-belt-flow"
                            style={{
                              animation: `conveyor-flow ${Math.max(0.5, 4 - (rate / 15))}s linear infinite`,
                              filter: "url(#glow)"
                            }}
                          />
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Inline CSS styling for conveyor animation */}
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes conveyor-flow {
                  to {
                    stroke-dashoffset: -24;
                  }
                }
                .conveyor-belt-flow {
                  animation: conveyor-flow 1.5s linear infinite;
                }
              `}} />

              {/* Nodes Card Overlay Layer */}
              <div className="absolute top-0 left-0 w-full h-full z-20 pointer-events-none">
                {activeChain.nodes.map((node) => {
                  const isSelected = node.id === selectedNodeId;
                  
                  // Calculate active status rates
                  let nodeRate = 0;
                  let hasActiveFlow = false;
                  
                  if (node.outputItem) {
                    nodeRate = ratesMap[node.outputItem]?.productionRate || 0;
                  } else if (node.inputItem) {
                    const inp = Array.isArray(node.inputItem) ? node.inputItem[0] : node.inputItem;
                    nodeRate = ratesMap[inp]?.consumptionRate || 0;
                  }
                  hasActiveFlow = nodeRate > 0;

                  // Machine Visual Types Styles
                  const borderStyle = isSelected 
                    ? "border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.25)] bg-zinc-900/95 animate-pulse" 
                    : "border-slate-800 bg-zinc-950/85 hover:border-slate-700 hover:bg-zinc-900/60";

                  // Status indicator bullet
                  const statusBullet = hasActiveFlow
                    ? "bg-emerald-500 animate-pulse border border-emerald-400"
                    : "bg-rose-500 border border-rose-400";

                  // Machine icons map
                  const typeIcon = {
                    Miner: <Zap className={`w-3.5 h-3.5 ${hasActiveFlow ? "text-orange-500 animate-bounce-subtle" : "text-slate-500"}`} />,
                    Smelter: <Cpu className={`w-3.5 h-3.5 ${hasActiveFlow ? "text-orange-500 animate-pulse" : "text-slate-500"}`} />,
                    Foundry: <Cpu className={`w-3.5 h-3.5 ${hasActiveFlow ? "text-orange-500 animate-pulse" : "text-slate-500"}`} />,
                    Constructor: <Layers className={`w-3.5 h-3.5 ${hasActiveFlow ? "text-orange-500 animate-bounce-subtle" : "text-slate-500"}`} />,
                    Assembler: <Boxes className={`w-3.5 h-3.5 ${hasActiveFlow ? "text-orange-500 animate-pulse" : "text-slate-500"}`} />,
                    Storage: <Database className="w-3.5 h-3.5 text-slate-400" />,
                    SubInput: <Activity className="w-3.5 h-3.5 text-slate-400" />
                  }[node.machineType];

                  // Target display label
                  const targetLabel = node.outputItem || (Array.isArray(node.inputItem) ? node.inputItem.join(" + ") : node.inputItem) || "No Output";

                  return (
                    <div
                      key={node.id}
                      onClick={() => setSelectedNodeId(node.id)}
                      className={`absolute pointer-events-auto cursor-pointer p-3 border rounded-lg transition-all duration-200 flex flex-col justify-between text-left select-none`}
                      style={{
                        left: `${node.x}px`,
                        top: `${node.y}px`,
                        width: `${nodeWidth}px`,
                        height: `${nodeHeight}px`
                      }}
                    >
                      {/* Outer Card structure wrapper */}
                      <div className={`absolute inset-0 border rounded-lg transition-all ${borderStyle}`}></div>

                      {/* Content Row 1: Header */}
                      <div className="relative z-10 flex justify-between items-center w-full">
                        <span className="text-[10px] font-mono font-bold text-slate-400 truncate flex items-center space-x-1.5 pr-2">
                          {typeIcon}
                          <span className="truncate">{node.name}</span>
                        </span>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusBullet}`}></span>
                      </div>

                      {/* Content Row 2: Flow readouts */}
                      <div className="relative z-10 font-mono text-[9px] text-slate-500 uppercase mt-1">
                        <div>Loop flow:</div>
                        <div className="text-[11px] font-bold text-slate-200 uppercase truncate mt-0.5" title={targetLabel}>
                          {targetLabel}
                        </div>
                      </div>

                      {/* Content Row 3: Live rate values */}
                      <div className="relative z-10 flex justify-between items-center w-full mt-1.5 pt-1.5 border-t border-slate-900/60 font-mono">
                        <span className="text-[8px] text-slate-500">THROUGHPUT</span>
                        <span className={`text-[10px] font-bold ${hasActiveFlow ? "text-emerald-400" : "text-slate-400"}`}>
                          {hasActiveFlow ? `${nodeRate.toFixed(1)}/m` : "0.0/m"}
                        </span>
                      </div>

                      {/* Node ports indicator dots */}
                      {/* Output port */}
                      {node.machineType !== "Storage" && (
                        <div className="absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-slate-700 bg-zinc-950 z-30"></div>
                      )}
                      {/* Input port */}
                      {node.machineType !== "Miner" && node.machineType !== "SubInput" && (
                        <>
                          {/* Top Port / Standard Input Port */}
                          <div className="absolute top-1/2 left-0 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-slate-700 bg-zinc-950 z-30"></div>
                          {/* Bottom input port for double-input assemblers */}
                          {(node.machineType === "Assembler" || node.machineType === "Foundry") && (
                            <>
                              <div className="absolute top-[30px] left-0 transform -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full border border-slate-700 bg-zinc-950 z-30"></div>
                              <div className="absolute top-[60px] left-0 transform -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full border border-slate-700 bg-zinc-950 z-30"></div>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        </div>

        {/* Right Side: Detailed Diagnostics Sidebar */}
        <div className="w-full lg:w-80 bg-zinc-900/30 border-t lg:border-t-0 border-slate-900 flex flex-col overflow-y-auto p-5 space-y-4 shrink-0 text-left">
          
          <div className="border-b border-slate-800 pb-3">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">DIAGNOSTIC TELEMETRY</span>
            <span className="text-sm font-mono font-bold text-slate-300 uppercase flex items-center">
              <TrendingUp className="w-4 h-4 mr-1 text-orange-500" /> MACHINE METRIC SWITCHBOARD
            </span>
          </div>

          {/* Node detailed specifications */}
          <AnimatePresence mode="wait">
            {selectedNode && selectedNodeStats ? (
              <motion.div
                key={selectedNode.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
                className="space-y-4 font-mono"
              >
                
                {/* Machine Name Card */}
                <div className="bg-zinc-950/60 border border-slate-800/80 rounded p-3.5 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase font-bold block">FICSIT UNIT REGISTER</span>
                      <h4 className="text-xs font-bold text-orange-500 uppercase">{selectedNode.name}</h4>
                    </div>
                    <span className="text-[8px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 uppercase font-bold shrink-0">
                      {selectedNode.machineType}
                    </span>
                  </div>
                  
                  {/* Performance Indicators */}
                  <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-900/60 text-[10px]">
                    <div>
                      <span className="text-slate-500 block">POWER DRAW</span>
                      <span className="text-slate-200 font-bold flex items-center">
                        <Zap className="w-3 h-3 text-orange-500 mr-0.5" />
                        {selectedNodeStats.powerUsed} MW
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">UNIT EFFICIENCY</span>
                      <span className={`font-bold flex items-center ${selectedNodeStats.efficiency > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        <Gauge className="w-3 h-3 mr-0.5" />
                        {selectedNodeStats.efficiency.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Efficiency Meter Gauge */}
                <div className="bg-zinc-950/60 border border-slate-800/80 rounded p-3.5 space-y-2">
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
                    <span>COUPLED STABILITY FEED</span>
                    <span className={selectedNodeStats.efficiency > 0 ? "text-emerald-400" : "text-rose-500"}>
                      {selectedNodeStats.efficiency > 90 ? "MAX STABLE" : selectedNodeStats.efficiency > 0 ? "DEGRADED" : "OFFLINE"}
                    </span>
                  </div>
                  <div className="w-full bg-zinc-900 border border-slate-950 h-2.5 rounded overflow-hidden relative">
                    <div 
                      className={`h-full transition-all duration-700 ${
                        selectedNodeStats.efficiency > 75 
                          ? "bg-gradient-to-r from-emerald-600 to-emerald-400" 
                          : selectedNodeStats.efficiency > 0 
                            ? "bg-gradient-to-r from-amber-600 to-amber-400" 
                            : "bg-rose-600"
                      }`}
                      style={{ width: `${selectedNodeStats.efficiency}%` }}
                    />
                  </div>
                </div>

                {/* Flow metrics Details */}
                <div className="bg-zinc-950/60 border border-slate-800/80 rounded p-3.5 space-y-2">
                  <span className="text-[9px] text-slate-500 uppercase block font-bold">PORT FLUIDS & METRICS</span>
                  
                  {selectedNode.machineType === "Storage" || selectedNode.machineType === "SubInput" ? (
                    <div className="text-[10px] text-slate-400 space-y-1.5">
                      <div className="flex justify-between">
                        <span>PORT MATERIAL:</span>
                        <span className="text-slate-200 uppercase font-bold">{selectedNodeStats.itemName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>ACTIVE RATE:</span>
                        <span className="text-emerald-400 font-bold">{selectedNodeStats.currentRate.toFixed(1)}/m</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-[10px]">
                      {/* Inputs Readout */}
                      {selectedNode.inputItem && (
                        <div className="space-y-1">
                          <span className="text-[8px] text-slate-500 block">INPUT PORT REGISTER</span>
                          {(() => {
                            const inputs = Array.isArray(selectedNode.inputItem) ? selectedNode.inputItem : [selectedNode.inputItem];
                            const inputRates = Array.isArray(selectedNode.standardInputRate) ? selectedNode.standardInputRate : [selectedNode.standardInputRate || 0];
                            
                            return inputs.map((inp, index) => {
                              const stdRate = inputRates[index] || 0;
                              const rateObj = ratesMap[inp];
                              const actualCons = rateObj ? rateObj.consumptionRate : 0;
                              return (
                                <div key={inp} className="flex justify-between bg-zinc-900/60 p-1.5 rounded border border-slate-950/50">
                                  <span className="text-slate-400 truncate max-w-[100px] uppercase">{inp}</span>
                                  <span className="text-slate-300 font-bold font-mono">
                                    {actualCons.toFixed(1)} <span className="text-[8px] text-slate-500">/{stdRate}m</span>
                                  </span>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      )}

                      {/* Outputs Readout */}
                      {selectedNode.outputItem && (
                        <div className="space-y-1 pt-1.5 border-t border-slate-900/60">
                          <span className="text-[8px] text-slate-500 block">OUTPUT PORT REGISTER</span>
                          <div className="flex justify-between bg-zinc-900/60 p-1.5 rounded border border-slate-950/50">
                            <span className="text-slate-400 truncate max-w-[100px] uppercase">{selectedNode.outputItem}</span>
                            <span className="text-emerald-400 font-bold font-mono">
                              {selectedNodeStats.currentRate.toFixed(1)} <span className="text-[8px] text-slate-500">/{selectedNode.standardOutputRate}m</span>
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Operations Guidelines */}
                <div className="bg-zinc-950/40 p-3 rounded border border-slate-900 text-[10px] text-slate-400 flex gap-2">
                  <Info className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Underclock/overclock adjustments are calculated relative to FICSIT standard blueprint rates. Double click cards to pin loop metrics.
                  </p>
                </div>

              </motion.div>
            ) : (
              <div className="py-20 text-center text-slate-600 font-mono text-xs">
                Select a machine node from the loop diagram to read real-time FICSIT diagnostic switchboard feeds.
              </div>
            )}
          </AnimatePresence>

          {/* Assembly Belt metrics Summary */}
          {activeChain && (
            <div className="bg-zinc-950/60 border border-slate-800/80 rounded p-3.5 space-y-2 mt-auto text-left font-mono">
              <span className="text-[9px] text-slate-500 uppercase block font-bold">Assembly Line Summary</span>
              <div className="space-y-1.5 text-[10px] text-slate-400">
                <div className="flex justify-between">
                  <span>Line Target:</span>
                  <span className="text-slate-200 font-bold uppercase">{activeChain.targetItem}</span>
                </div>
                <div className="flex justify-between">
                  <span>Target Net Rate:</span>
                  <span className="text-emerald-400 font-bold">
                    {(ratesMap[activeChain.targetItem]?.productionRate || 0).toFixed(1)}/min
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total Machines:</span>
                  <span className="text-slate-200">
                    {activeChain.nodes.filter(n => n.machineType !== "Storage" && n.machineType !== "SubInput").length} units
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Cumulative Load:</span>
                  <span className="text-slate-200">
                    {activeChain.nodes.reduce((acc, curr) => acc + (ratesMap[curr.outputItem || ""]?.productionRate > 0 || ratesMap[Array.isArray(curr.inputItem) ? curr.inputItem[0] : curr.inputItem || ""]?.consumptionRate > 0 ? curr.powerMw : 0), 0)} MW
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
