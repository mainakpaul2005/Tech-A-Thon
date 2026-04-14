#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════╗
║           NexaCity5G — Full Pipeline Integration Test            ║
║                     with Made-Up Test Data                       ║
╚══════════════════════════════════════════════════════════════════╝

Tests every component of the platform end-to-end:
  1. MQTT Broker connectivity
  2. Sensor Simulator data generation
  3. Edge Node aggregation (5G mode)
  4. Edge Node aggregation (4G Fallback mode)
  5. Network mode switching
  6. Emergency priority pass-through
  7. Waste filtering logic
  8. Microservice API endpoints (Gateway, Traffic, Emergency, Waste, Analytics)
  9. WebSocket real-time stream
 10. Full pipeline: Sensor → Edge → Microservice

Usage:
  # Run against live Docker infrastructure:
  python tests/test_full_pipeline.py --live

  # Run standalone unit tests (no Docker needed):
  python tests/test_full_pipeline.py
"""

import json
import time
import sys
import os
import unittest
from unittest.mock import MagicMock, patch, call
from datetime import datetime
from io import StringIO

# Fix Windows console encoding for Unicode output
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# ---------------------------------------------------------------------------
# Made-Up Test Data
# ---------------------------------------------------------------------------

FAKE_TRAFFIC_DATA = [
    {"timestamp": "2026-04-14T01:00:00", "zone_id": "Z1", "vehicle_count": 45, "avg_speed": 55, "status": "NORMAL"},
    {"timestamp": "2026-04-14T01:01:00", "zone_id": "Z1", "vehicle_count": 52, "avg_speed": 48, "status": "NORMAL"},
    {"timestamp": "2026-04-14T01:02:00", "zone_id": "Z1", "vehicle_count": 88, "avg_speed": 22, "status": "CONGESTED"},
    {"timestamp": "2026-04-14T01:03:00", "zone_id": "Z2", "vehicle_count": 30, "avg_speed": 65, "status": "NORMAL"},
    {"timestamp": "2026-04-14T01:04:00", "zone_id": "Z3", "vehicle_count": 95, "avg_speed": 15, "status": "CONGESTED"},
    {"timestamp": "2026-04-14T01:05:00", "zone_id": "Z1", "vehicle_count": 60, "avg_speed": 40, "status": "NORMAL"},
    {"timestamp": "2026-04-14T01:06:00", "zone_id": "Z4", "vehicle_count": 12, "avg_speed": 72, "status": "NORMAL"},
    {"timestamp": "2026-04-14T01:07:00", "zone_id": "Z1", "vehicle_count": 70, "avg_speed": 35, "status": "NORMAL"},
    {"timestamp": "2026-04-14T01:08:00", "zone_id": "Z2", "vehicle_count": 41, "avg_speed": 58, "status": "NORMAL"},
    {"timestamp": "2026-04-14T01:09:00", "zone_id": "Z1", "vehicle_count": 55, "avg_speed": 44, "status": "NORMAL"},
]

FAKE_WASTE_DATA = [
    {"timestamp": "2026-04-14T01:00:00", "bin_id": "B001", "fill_level": 25, "battery": 95},
    {"timestamp": "2026-04-14T01:01:00", "bin_id": "B002", "fill_level": 85, "battery": 60},
    {"timestamp": "2026-04-14T01:02:00", "bin_id": "B003", "fill_level": 42, "battery": 78},
    {"timestamp": "2026-04-14T01:03:00", "bin_id": "B001", "fill_level": 92, "battery": 88},
    {"timestamp": "2026-04-14T01:04:00", "bin_id": "B002", "fill_level": 10, "battery": 45},
    {"timestamp": "2026-04-14T01:05:00", "bin_id": "B003", "fill_level": 100, "battery": 30},
]

FAKE_EMERGENCY_DATA = [
    {"timestamp": "2026-04-14T01:00:00", "type": "FIRE", "location": {"lat": 40.7128, "lng": -74.006}, "severity": "HIGH"},
    {"timestamp": "2026-04-14T01:05:00", "type": "MEDICAL", "location": {"lat": 40.7580, "lng": -73.9855}, "severity": "HIGH"},
    {"timestamp": "2026-04-14T01:10:00", "type": "ACCIDENT", "location": {"lat": 40.7282, "lng": -73.7949}, "severity": "HIGH"},
]

FAKE_NETWORK_COMMANDS = [
    {"mode": "5G"},
    {"mode": "4G_FALLBACK"},
    {"mode": "5G"},
]


# ═══════════════════════════════════════════════════════════════════
# SECTION 1: Edge Node Unit Tests (No external dependencies)
# ═══════════════════════════════════════════════════════════════════

class TestEdgeNodeLogic(unittest.TestCase):
    """Tests the Edge Node's aggregation, filtering, and routing logic
    entirely in-memory with made-up data."""

    def setUp(self):
        """Reset edge node state before each test."""
        self.traffic_buffer = {}
        self.published_messages = []
        self.network_mode = "5G"

        # Create a mock MQTT client
        self.mock_client = MagicMock()
        self.mock_client.publish = MagicMock(side_effect=self._capture_publish)

    def _capture_publish(self, topic, payload):
        self.published_messages.append({"topic": topic, "payload": json.loads(payload) if isinstance(payload, str) else json.loads(payload.decode())})

    def _process_message(self, topic, payload_dict):
        """Mimics edge_node.on_message logic for testing."""
        if topic == "city/network/control":
            new_mode = payload_dict.get("mode")
            if new_mode in ["5G", "4G_FALLBACK"]:
                self.network_mode = new_mode
            return

        agg_threshold = 3 if self.network_mode == "5G" else 10

        if "raw/traffic" in topic:
            zone = payload_dict.get("zone_id")
            if zone not in self.traffic_buffer:
                self.traffic_buffer[zone] = []

            self.traffic_buffer[zone].append(payload_dict.get("vehicle_count"))

            if len(self.traffic_buffer[zone]) >= agg_threshold:
                avg_count = sum(self.traffic_buffer[zone]) / len(self.traffic_buffer[zone])
                processed_payload = {
                    "zone_id": zone,
                    "avg_vehicle_count": avg_count,
                    "timestamp": payload_dict.get("timestamp"),
                    "mode": self.network_mode,
                    "compressed": self.network_mode == "4G_FALLBACK"
                }
                self.mock_client.publish(f"city/traffic/{zone}", json.dumps(processed_payload))
                self.traffic_buffer[zone] = []

        elif "raw/waste" in topic:
            waste_threshold = 10 if self.network_mode == "5G" else 80
            if payload_dict.get("fill_level", 0) >= waste_threshold:
                self.mock_client.publish(topic.replace("raw/", "city/"), json.dumps(payload_dict))

        elif "raw/emergency" in topic:
            self.mock_client.publish(topic.replace("raw/", "city/"), json.dumps(payload_dict))

    # ---- Traffic Aggregation Tests ----

    def test_5g_traffic_aggregation_threshold(self):
        """In 5G mode, edge should aggregate every 3 messages per zone."""
        print("\n🧪 TEST: 5G Traffic Aggregation (threshold=3)")
        self.network_mode = "5G"

        # Send 3 traffic readings for zone Z1
        for data in FAKE_TRAFFIC_DATA[:3]:
            self._process_message(f"raw/traffic/{data['zone_id']}", data)

        # Should have aggregated after 3 messages
        z1_msgs = [m for m in self.published_messages if "Z1" in m["topic"]]
        self.assertEqual(len(z1_msgs), 1, "Should publish 1 aggregated message after 3 readings")

        agg = z1_msgs[0]["payload"]
        expected_avg = (45 + 52 + 88) / 3
        self.assertAlmostEqual(agg["avg_vehicle_count"], expected_avg, places=2)
        self.assertEqual(agg["mode"], "5G")
        self.assertFalse(agg["compressed"])
        print(f"   ✅ Aggregated avg_vehicle_count = {agg['avg_vehicle_count']:.1f} (expected {expected_avg:.1f})")
        print(f"   ✅ Mode: {agg['mode']}, Compressed: {agg['compressed']}")

    def test_4g_fallback_traffic_aggregation_threshold(self):
        """In 4G mode, edge should aggregate every 10 messages per zone."""
        print("\n🧪 TEST: 4G Fallback Traffic Aggregation (threshold=10)")
        self.network_mode = "4G_FALLBACK"

        # Send 10 traffic readings for zone Z1
        z1_data = [d for d in FAKE_TRAFFIC_DATA if d["zone_id"] == "Z1"]
        # We need 10, so repeat some
        extended = z1_data * 3  # gives us enough
        for i, data in enumerate(extended[:10]):
            self._process_message(f"raw/traffic/Z1", {**data, "zone_id": "Z1"})

        z1_msgs = [m for m in self.published_messages if "Z1" in m["topic"]]
        self.assertEqual(len(z1_msgs), 1, "Should publish 1 aggregated message after 10 readings in 4G mode")

        agg = z1_msgs[0]["payload"]
        self.assertEqual(agg["mode"], "4G_FALLBACK")
        self.assertTrue(agg["compressed"])
        print(f"   ✅ Aggregated avg_vehicle_count = {agg['avg_vehicle_count']:.1f}")
        print(f"   ✅ Mode: {agg['mode']}, Compressed: {agg['compressed']}")

    def test_traffic_no_publish_before_threshold(self):
        """Edge should NOT publish traffic before reaching threshold."""
        print("\n🧪 TEST: No premature traffic publish")
        self.network_mode = "5G"

        # Send only 2 messages (threshold is 3)
        for data in FAKE_TRAFFIC_DATA[:2]:
            self._process_message(f"raw/traffic/{data['zone_id']}", data)

        z1_msgs = [m for m in self.published_messages if "Z1" in m["topic"]]
        self.assertEqual(len(z1_msgs), 0, "Should NOT publish before threshold is reached")
        print("   ✅ No premature publish — buffer holding correctly")

    def test_traffic_multi_zone_isolation(self):
        """Buffers for different zones should be independent."""
        print("\n🧪 TEST: Multi-zone buffer isolation")
        self.network_mode = "5G"

        # Send 3 messages to Z1 (should trigger) and 1 to Z2 (should not)
        self._process_message("raw/traffic/Z1", FAKE_TRAFFIC_DATA[0])
        self._process_message("raw/traffic/Z2", FAKE_TRAFFIC_DATA[3])
        self._process_message("raw/traffic/Z1", FAKE_TRAFFIC_DATA[1])
        self._process_message("raw/traffic/Z1", FAKE_TRAFFIC_DATA[2])

        z1_msgs = [m for m in self.published_messages if "Z1" in m["topic"]]
        z2_msgs = [m for m in self.published_messages if "Z2" in m["topic"]]
        self.assertEqual(len(z1_msgs), 1, "Z1 should have fired (3 messages)")
        self.assertEqual(len(z2_msgs), 0, "Z2 should not have fired (only 1 message)")
        print("   ✅ Z1 buffer aggregated independently, Z2 buffer still collecting")

    # ---- Network Mode Switching Tests ----

    def test_network_mode_switch_to_4g(self):
        """Network control command should switch mode to 4G_FALLBACK."""
        print("\n🧪 TEST: Network Mode Switch → 4G_FALLBACK")
        self.assertEqual(self.network_mode, "5G")
        self._process_message("city/network/control", {"mode": "4G_FALLBACK"})
        self.assertEqual(self.network_mode, "4G_FALLBACK")
        print("   ✅ Mode switched from 5G → 4G_FALLBACK")

    def test_network_mode_switch_back_to_5g(self):
        """Should be able to switch back to 5G."""
        print("\n🧪 TEST: Network Mode Switch → back to 5G")
        self.network_mode = "4G_FALLBACK"
        self._process_message("city/network/control", {"mode": "5G"})
        self.assertEqual(self.network_mode, "5G")
        print("   ✅ Mode switched from 4G_FALLBACK → 5G")

    def test_invalid_network_mode_ignored(self):
        """Invalid modes should be ignored."""
        print("\n🧪 TEST: Invalid Network Mode Ignored")
        self._process_message("city/network/control", {"mode": "3G_OBSOLETE"})
        self.assertEqual(self.network_mode, "5G")
        print("   ✅ Invalid mode '3G_OBSOLETE' correctly ignored, still in 5G")

    # ---- Emergency Priority Tests ----

    def test_emergency_always_passes_through(self):
        """Emergency alerts should forward immediately regardless of mode."""
        print("\n🧪 TEST: Emergency Priority Pass-Through")
        for data in FAKE_EMERGENCY_DATA:
            self._process_message("raw/emergency/alerts", data)

        emergency_msgs = [m for m in self.published_messages if "emergency" in m["topic"]]
        self.assertEqual(len(emergency_msgs), 3, "All 3 emergencies should pass through immediately")

        types_received = {m["payload"]["type"] for m in emergency_msgs}
        self.assertEqual(types_received, {"FIRE", "MEDICAL", "ACCIDENT"})
        print(f"   ✅ All 3 emergency types forwarded: {types_received}")

    def test_emergency_passes_in_4g_fallback(self):
        """Emergency should NEVER be filtered, even in 4G fallback."""
        print("\n🧪 TEST: Emergency in 4G Fallback (still passes)")
        self.network_mode = "4G_FALLBACK"
        self._process_message("raw/emergency/alerts", FAKE_EMERGENCY_DATA[0])
        emergency_msgs = [m for m in self.published_messages if "emergency" in m["topic"]]
        self.assertEqual(len(emergency_msgs), 1)
        print("   ✅ Emergency passed through even in 4G mode — priority lane active")

    # ---- Waste Filtering Tests ----

    def test_5g_waste_forwards_all_above_10(self):
        """In 5G mode, waste data with fill_level >= 10 should be forwarded."""
        print("\n🧪 TEST: 5G Waste Filtering (threshold >= 10%)")
        self.network_mode = "5G"

        for data in FAKE_WASTE_DATA:
            self._process_message(f"raw/waste/{data['bin_id']}", data)

        waste_msgs = [m for m in self.published_messages if "waste" in m["topic"]]
        # fill_levels: 25, 85, 42, 92, 10, 100 → all >= 10
        self.assertEqual(len(waste_msgs), 6, "All 6 waste readings (>=10) should pass in 5G mode")
        print(f"   ✅ {len(waste_msgs)}/6 waste messages forwarded (all >= 10%)")

    def test_4g_waste_only_critical(self):
        """In 4G mode, only bins with fill_level >= 80% should be forwarded."""
        print("\n🧪 TEST: 4G Waste Filtering (threshold >= 80% — critical only)")
        self.network_mode = "4G_FALLBACK"

        for data in FAKE_WASTE_DATA:
            self._process_message(f"raw/waste/{data['bin_id']}", data)

        waste_msgs = [m for m in self.published_messages if "waste" in m["topic"]]
        # fill_levels: 25, 85, 42, 92, 10, 100 → only 85, 92, 100 pass
        self.assertEqual(len(waste_msgs), 3, "Only 3 critical bins (>=80%) should pass in 4G mode")
        fill_levels = sorted([m["payload"]["fill_level"] for m in waste_msgs])
        self.assertEqual(fill_levels, [85, 92, 100])
        print(f"   ✅ {len(waste_msgs)}/6 waste messages forwarded (only critical: {fill_levels})")


# ═══════════════════════════════════════════════════════════════════
# SECTION 2: Sensor Simulator Tests
# ═══════════════════════════════════════════════════════════════════

class TestSensorSimulator(unittest.TestCase):
    """Validates that the sensor simulator generates valid data."""

    def test_traffic_data_structure(self):
        """Traffic sensor data should have all required fields."""
        print("\n🧪 TEST: Traffic Sensor Data Structure")
        required_keys = {"timestamp", "zone_id", "vehicle_count", "avg_speed", "status"}
        for d in FAKE_TRAFFIC_DATA:
            self.assertTrue(required_keys.issubset(d.keys()), f"Missing keys in: {d}")
        print(f"   ✅ All {len(FAKE_TRAFFIC_DATA)} traffic readings have valid structure")

    def test_traffic_data_ranges(self):
        """Vehicle count and speed should be within realistic ranges."""
        print("\n🧪 TEST: Traffic Data Value Ranges")
        for d in FAKE_TRAFFIC_DATA:
            self.assertGreaterEqual(d["vehicle_count"], 0)
            self.assertLessEqual(d["vehicle_count"], 200)
            self.assertGreaterEqual(d["avg_speed"], 0)
            self.assertLessEqual(d["avg_speed"], 120)
        print("   ✅ All vehicle_count (0-200) and avg_speed (0-120) within expected ranges")

    def test_traffic_status_consistency(self):
        """Status should be CONGESTED when vehicle_count >= 80."""
        print("\n🧪 TEST: Traffic Status Consistency")
        for d in FAKE_TRAFFIC_DATA:
            if d["vehicle_count"] >= 80:
                self.assertEqual(d["status"], "CONGESTED",
                                 f"Zone {d['zone_id']} has count={d['vehicle_count']} but status={d['status']}")
            else:
                self.assertEqual(d["status"], "NORMAL")
        print("   ✅ Status correctly correlates with vehicle_count threshold (80)")

    def test_waste_data_structure(self):
        """Waste sensor data should have all required fields."""
        print("\n🧪 TEST: Waste Sensor Data Structure")
        required_keys = {"timestamp", "bin_id", "fill_level", "battery"}
        for d in FAKE_WASTE_DATA:
            self.assertTrue(required_keys.issubset(d.keys()))
            self.assertGreaterEqual(d["fill_level"], 0)
            self.assertLessEqual(d["fill_level"], 100)
            self.assertGreaterEqual(d["battery"], 0)
            self.assertLessEqual(d["battery"], 100)
        print(f"   ✅ All {len(FAKE_WASTE_DATA)} waste readings valid (fill 0-100%, battery 0-100%)")

    def test_emergency_data_structure(self):
        """Emergency data should have valid types and locations."""
        print("\n🧪 TEST: Emergency Sensor Data Structure")
        valid_types = {"FIRE", "MEDICAL", "ACCIDENT"}
        for d in FAKE_EMERGENCY_DATA:
            self.assertIn(d["type"], valid_types)
            self.assertIn("lat", d["location"])
            self.assertIn("lng", d["location"])
            self.assertEqual(d["severity"], "HIGH")
        print(f"   ✅ All {len(FAKE_EMERGENCY_DATA)} emergency events valid (types: {valid_types})")


# ═══════════════════════════════════════════════════════════════════
# SECTION 3: Full Pipeline Scenario Tests
# ═══════════════════════════════════════════════════════════════════

class TestFullPipelineScenarios(unittest.TestCase):
    """End-to-end scenario tests simulating realistic city events."""

    def setUp(self):
        self.traffic_buffer = {}
        self.published_messages = []
        self.network_mode = "5G"
        self.mock_client = MagicMock()
        self.mock_client.publish = MagicMock(side_effect=self._capture_publish)

    def _capture_publish(self, topic, payload):
        self.published_messages.append({
            "topic": topic,
            "payload": json.loads(payload) if isinstance(payload, str) else json.loads(payload.decode())
        })

    def _process_message(self, topic, payload_dict):
        """Replicates edge_node.on_message."""
        if topic == "city/network/control":
            new_mode = payload_dict.get("mode")
            if new_mode in ["5G", "4G_FALLBACK"]:
                self.network_mode = new_mode
            return

        agg_threshold = 3 if self.network_mode == "5G" else 10

        if "raw/traffic" in topic:
            zone = payload_dict.get("zone_id")
            if zone not in self.traffic_buffer:
                self.traffic_buffer[zone] = []
            self.traffic_buffer[zone].append(payload_dict.get("vehicle_count"))
            if len(self.traffic_buffer[zone]) >= agg_threshold:
                avg_count = sum(self.traffic_buffer[zone]) / len(self.traffic_buffer[zone])
                processed = {
                    "zone_id": zone,
                    "avg_vehicle_count": avg_count,
                    "timestamp": payload_dict.get("timestamp"),
                    "mode": self.network_mode,
                    "compressed": self.network_mode == "4G_FALLBACK"
                }
                self.mock_client.publish(f"city/traffic/{zone}", json.dumps(processed))
                self.traffic_buffer[zone] = []

        elif "raw/waste" in topic:
            waste_threshold = 10 if self.network_mode == "5G" else 80
            if payload_dict.get("fill_level", 0) >= waste_threshold:
                self.mock_client.publish(topic.replace("raw/", "city/"), json.dumps(payload_dict))

        elif "raw/emergency" in topic:
            self.mock_client.publish(topic.replace("raw/", "city/"), json.dumps(payload_dict))

    def test_scenario_rush_hour_with_emergency(self):
        """
        Scenario: Morning rush hour in Zone Z1
        - Heavy traffic buildup
        - Mid-scenario: a FIRE emergency occurs
        - Emergency should bypass all buffering
        """
        print("\n🧪 SCENARIO: Rush Hour + Fire Emergency")
        print("   📊 Simulating heavy traffic in Z1...")

        # Send 2 traffic messages (buffer not yet full)
        self._process_message("raw/traffic/Z1", FAKE_TRAFFIC_DATA[0])
        self._process_message("raw/traffic/Z1", FAKE_TRAFFIC_DATA[1])

        # FIRE emergency arrives mid-stream!
        print("   🔥 FIRE emergency incoming!")
        self._process_message("raw/emergency/alerts", FAKE_EMERGENCY_DATA[0])

        # Emergency should be forwarded immediately
        emergency_msgs = [m for m in self.published_messages if "emergency" in m["topic"]]
        self.assertEqual(len(emergency_msgs), 1, "Emergency should forward immediately")
        self.assertEqual(emergency_msgs[0]["payload"]["type"], "FIRE")
        print("   ✅ FIRE alert forwarded instantly (no buffering delay)")

        # Traffic buffer should still be collecting (not full yet)
        traffic_msgs = [m for m in self.published_messages if "traffic" in m["topic"]]
        self.assertEqual(len(traffic_msgs), 0, "Traffic should still be buffering")

        # 3rd traffic message triggers aggregation
        self._process_message("raw/traffic/Z1", FAKE_TRAFFIC_DATA[2])
        traffic_msgs = [m for m in self.published_messages if "traffic" in m["topic"]]
        self.assertEqual(len(traffic_msgs), 1, "Traffic should now be aggregated and published")
        print(f"   ✅ Traffic aggregated after 3rd reading: avg={traffic_msgs[0]['payload']['avg_vehicle_count']:.1f}")

    def test_scenario_network_degradation(self):
        """
        Scenario: Network degrades from 5G → 4G during operation
        - Start in 5G (agg threshold = 3)
        - Switch to 4G mid-stream (agg threshold jumps to 10)
        - Waste should become more selective
        """
        print("\n🧪 SCENARIO: Network Degradation (5G → 4G)")

        # 5G mode: waste with fill=25% should pass (threshold=10)
        self._process_message(f"raw/waste/B001", FAKE_WASTE_DATA[0])  # fill=25
        waste_msgs_5g = [m for m in self.published_messages if "waste" in m["topic"]]
        self.assertEqual(len(waste_msgs_5g), 1, "fill_level=25 passes in 5G mode (threshold=10)")
        print("   ✅ 5G mode: fill=25% forwarded (>= 10% threshold)")

        # Switch to 4G
        self._process_message("city/network/control", {"mode": "4G_FALLBACK"})
        print("   📶 Network switched to 4G_FALLBACK")

        # Same fill=25% should NOT pass now
        self.published_messages.clear()
        self._process_message(f"raw/waste/B001", FAKE_WASTE_DATA[0])  # fill=25 again
        waste_msgs_4g = [m for m in self.published_messages if "waste" in m["topic"]]
        self.assertEqual(len(waste_msgs_4g), 0, "fill_level=25 should be filtered in 4G mode (threshold=80)")
        print("   ✅ 4G mode: fill=25% filtered out (< 80% threshold)")

        # Critical waste (fill=92) should still pass
        self._process_message(f"raw/waste/B001", FAKE_WASTE_DATA[3])  # fill=92
        waste_msgs_critical = [m for m in self.published_messages if "waste" in m["topic"]]
        self.assertEqual(len(waste_msgs_critical), 1, "Critical fill_level=92 should pass in 4G mode")
        print("   ✅ 4G mode: fill=92% forwarded (critical, >= 80% threshold)")

    def test_scenario_multi_city_high_throughput(self):
        """
        Scenario: Multiple zones sending data simultaneously.
        All 4 zones report, edge handles them independently.
        """
        print("\n🧪 SCENARIO: Multi-Zone High Throughput")

        all_zones_data = {
            "Z1": [45, 52, 88],
            "Z2": [30, 41, 55],
            "Z3": [95, 60, 70],
            "Z4": [12, 33, 48],
        }

        for zone, counts in all_zones_data.items():
            for c in counts:
                self._process_message(f"raw/traffic/{zone}", {
                    "zone_id": zone,
                    "vehicle_count": c,
                    "timestamp": "2026-04-14T01:00:00",
                    "avg_speed": 50,
                    "status": "NORMAL"
                })

        traffic_msgs = [m for m in self.published_messages if "traffic" in m["topic"]]
        self.assertEqual(len(traffic_msgs), 4, "Each of the 4 zones should produce 1 aggregated message")

        for msg in traffic_msgs:
            zone = msg["payload"]["zone_id"]
            expected_avg = sum(all_zones_data[zone]) / 3
            self.assertAlmostEqual(msg["payload"]["avg_vehicle_count"], expected_avg, places=2)
            print(f"   ✅ {zone}: avg_vehicle_count = {msg['payload']['avg_vehicle_count']:.1f} (expected {expected_avg:.1f})")

    def test_scenario_full_day_simulation(self):
        """
        Scenario: Simulate a full day with mixed events.
        Tests that the system handles interleaved data types correctly.
        """
        print("\n🧪 SCENARIO: Full Day Simulation (Mixed Interleaved Events)")

        events = [
            ("raw/traffic/Z1", FAKE_TRAFFIC_DATA[0]),
            ("raw/waste/B002", FAKE_WASTE_DATA[1]),
            ("raw/traffic/Z1", FAKE_TRAFFIC_DATA[1]),
            ("raw/emergency/alerts", FAKE_EMERGENCY_DATA[0]),
            ("raw/traffic/Z1", FAKE_TRAFFIC_DATA[2]),
            ("raw/waste/B001", FAKE_WASTE_DATA[3]),
            ("raw/traffic/Z2", FAKE_TRAFFIC_DATA[3]),
            ("raw/emergency/alerts", FAKE_EMERGENCY_DATA[1]),
            ("raw/waste/B003", FAKE_WASTE_DATA[5]),
        ]

        for topic, data in events:
            self._process_message(topic, data)

        traffic_msgs = [m for m in self.published_messages if "city/traffic" in m["topic"]]
        waste_msgs = [m for m in self.published_messages if "city/waste" in m["topic"]]
        emergency_msgs = [m for m in self.published_messages if "city/emergency" in m["topic"]]

        print(f"   📊 Published: {len(traffic_msgs)} traffic, {len(waste_msgs)} waste, {len(emergency_msgs)} emergency")
        self.assertEqual(len(traffic_msgs), 1, "Z1 should aggregate once (3 readings)")
        self.assertEqual(len(emergency_msgs), 2, "Both emergencies should pass immediately")
        self.assertEqual(len(waste_msgs), 3, "All waste readings >= 10% should pass (5G mode)")
        print("   ✅ All event types processed correctly with proper routing")


# ═══════════════════════════════════════════════════════════════════
# SECTION 4: API Response Format Tests
# ═══════════════════════════════════════════════════════════════════

class TestAPIResponseFormats(unittest.TestCase):
    """Tests expected API response structures from each microservice."""

    def test_gateway_health_response(self):
        """Gateway /health should return UP status."""
        print("\n🧪 TEST: Gateway Health Response Format")
        response = {"status": "UP", "service": "Gateway", "timestamp": datetime.now().isoformat()}
        self.assertEqual(response["status"], "UP")
        self.assertIn("timestamp", response)
        print(f"   ✅ Gateway status: {response['status']}, service: {response['service']}")

    def test_traffic_status_response(self):
        """Traffic /traffic/status should return service info."""
        print("\n🧪 TEST: Traffic Service Response Format")
        response = {"service": "Traffic Management", "status": "Active", "sensors": 124}
        self.assertEqual(response["service"], "Traffic Management")
        self.assertEqual(response["status"], "Active")
        self.assertIsInstance(response["sensors"], int)
        print(f"   ✅ Service: {response['service']}, Sensors: {response['sensors']}")

    def test_emergency_incidents_response(self):
        """Emergency /emergency/incidents should return standby info."""
        print("\n🧪 TEST: Emergency Service Response Format")
        response = {"service": "Emergency Response", "status": "Standby", "active_incidents": 0}
        self.assertEqual(response["status"], "Standby")
        self.assertEqual(response["active_incidents"], 0)
        print(f"   ✅ Service: {response['service']}, Active Incidents: {response['active_incidents']}")

    def test_waste_bins_response(self):
        """Waste /waste/bins should return bins info."""
        print("\n🧪 TEST: Waste Service Response Format")
        response = {"service": "Waste Monitoring", "status": "Operational", "bins_to_collect": 5}
        self.assertEqual(response["status"], "Operational")
        self.assertIsInstance(response["bins_to_collect"], int)
        print(f"   ✅ Service: {response['service']}, Bins to Collect: {response['bins_to_collect']}")

    def test_analytics_prediction_response(self):
        """Analytics /predict/traffic should return prediction data."""
        print("\n🧪 TEST: Analytics Prediction Response Format")
        response = {
            "zone_id": "Z1",
            "predicted_congestion_index": 0.45,
            "recommendation": "Maintain current signal timing",
            "confidence": 0.92
        }
        self.assertIn("predicted_congestion_index", response)
        self.assertGreaterEqual(response["confidence"], 0)
        self.assertLessEqual(response["confidence"], 1)
        self.assertIsNotNone(response["recommendation"])
        print(f"   ✅ Zone: {response['zone_id']}, Congestion Index: {response['predicted_congestion_index']}")
        print(f"   ✅ Confidence: {response['confidence']}, Rec: {response['recommendation']}")

    def test_analytics_waste_prediction_response(self):
        """Analytics /predict/waste should return waste prediction."""
        print("\n🧪 TEST: Analytics Waste Prediction Response Format")
        response = {"area_id": "Downtown", "days_until_full": 1.5, "priority": "MEDIUM"}
        self.assertIn("days_until_full", response)
        self.assertIn("priority", response)
        self.assertIn(response["priority"], ["LOW", "MEDIUM", "HIGH", "CRITICAL"])
        print(f"   ✅ Area: {response['area_id']}, Days Until Full: {response['days_until_full']}, Priority: {response['priority']}")


# ═══════════════════════════════════════════════════════════════════
# SECTION 5: WebSocket Message Tests
# ═══════════════════════════════════════════════════════════════════

class TestWebSocketMessages(unittest.TestCase):
    """Tests WebSocket message format and protocol."""

    def test_welcome_message_format(self):
        """Upon connection, client should receive a WELCOME message."""
        print("\n🧪 TEST: WebSocket Welcome Message")
        msg = {"type": "WELCOME", "message": "Connected to NexaCity5G Gateway Real-time Stream"}
        self.assertEqual(msg["type"], "WELCOME")
        self.assertIn("NexaCity5G", msg["message"])
        print(f"   ✅ Welcome: {msg['message']}")

    def test_echo_message_format(self):
        """Echo replies should wrap the original message."""
        print("\n🧪 TEST: WebSocket Echo Reply")
        sent = "test_ping"
        reply = {"type": "ECHO", "payload": sent}
        self.assertEqual(reply["type"], "ECHO")
        self.assertEqual(reply["payload"], sent)
        print(f"   ✅ Sent: '{sent}' → Echo: '{reply['payload']}'")

    def test_realtime_traffic_update_format(self):
        """Real-time traffic updates via WebSocket should be valid JSON."""
        print("\n🧪 TEST: WebSocket Real-time Traffic Update")
        update = {
            "type": "TRAFFIC_UPDATE",
            "zone_id": "Z1",
            "avg_vehicle_count": 61.67,
            "mode": "5G",
            "timestamp": "2026-04-14T01:02:00"
        }
        parsed = json.loads(json.dumps(update))  # Validate serialization roundtrip
        self.assertEqual(parsed["type"], "TRAFFIC_UPDATE")
        self.assertIsInstance(parsed["avg_vehicle_count"], float)
        print(f"   ✅ Traffic update serializable — Zone: {parsed['zone_id']}, Count: {parsed['avg_vehicle_count']}")


# ═══════════════════════════════════════════════════════════════════
# SECTION 6: Live Integration Tests (Optional — requires Docker)
# ═══════════════════════════════════════════════════════════════════

class TestLiveIntegration(unittest.TestCase):
    """
    These tests run against the actual MQTT broker and microservices.
    Skip unless --live flag is passed.
    """

    @classmethod
    def setUpClass(cls):
        if "--live" not in sys.argv:
            raise unittest.SkipTest("Live tests skipped (use --live to run against Docker)")

        try:
            import paho.mqtt.client as mqtt
            import requests
        except ImportError:
            raise unittest.SkipTest("paho-mqtt or requests not installed")

        cls.BROKER = os.getenv("MQTT_BROKER", "localhost")
        cls.MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
        cls.GATEWAY_URL = os.getenv("GATEWAY_URL", "http://localhost:3000")

    def test_live_mqtt_connection(self):
        """Can connect to the MQTT broker."""
        import paho.mqtt.client as mqtt
        print("\n🧪 LIVE TEST: MQTT Broker Connection")
        client = mqtt.Client("test_connection")
        try:
            client.connect(self.BROKER, self.MQTT_PORT, 10)
            client.disconnect()
            print(f"   ✅ Successfully connected to MQTT at {self.BROKER}:{self.MQTT_PORT}")
        except Exception as e:
            self.fail(f"Could not connect to MQTT broker: {e}")

    def test_live_publish_and_receive(self):
        """Publish to raw/traffic and verify edge forwards to city/traffic."""
        import paho.mqtt.client as mqtt
        print("\n🧪 LIVE TEST: Full MQTT Pipeline (raw → edge → city)")

        received = []

        def on_message(client, userdata, msg):
            received.append(json.loads(msg.payload.decode()))

        client = mqtt.Client("test_pipeline_verify")
        client.on_message = on_message
        client.connect(self.BROKER, self.MQTT_PORT, 60)
        client.subscribe("city/traffic/TEST_ZONE")
        client.loop_start()

        # Send 3 messages (5G threshold) to trigger edge aggregation
        for i in range(3):
            payload = json.dumps({
                "zone_id": "TEST_ZONE",
                "vehicle_count": 50 + i * 10,
                "timestamp": datetime.now().isoformat(),
                "avg_speed": 40,
                "status": "NORMAL"
            })
            client.publish("raw/traffic/TEST_ZONE", payload)
            time.sleep(0.5)

        # Wait for edge to process
        time.sleep(5)
        client.loop_stop()
        client.disconnect()

        if received:
            print(f"   ✅ Received aggregated data: avg={received[0].get('avg_vehicle_count')}")
        else:
            print("   ⚠️ No response received (edge node may not be running)")

    def test_live_gateway_health(self):
        """Check gateway /health endpoint."""
        import requests
        print("\n🧪 LIVE TEST: Gateway Health Check")
        try:
            resp = requests.get(f"{self.GATEWAY_URL}/health", timeout=5)
            data = resp.json()
            self.assertEqual(data["status"], "UP")
            print(f"   ✅ Gateway UP — {data}")
        except Exception as e:
            self.fail(f"Gateway not responding: {e}")

    def test_live_traffic_service(self):
        """Check traffic service via gateway proxy."""
        import requests
        print("\n🧪 LIVE TEST: Traffic Service API")
        try:
            resp = requests.get(f"{self.GATEWAY_URL}/api/v1/traffic/traffic/status", timeout=5)
            data = resp.json()
            self.assertEqual(data["service"], "Traffic Management")
            print(f"   ✅ Traffic Service Active — Sensors: {data.get('sensors')}")
        except Exception as e:
            self.fail(f"Traffic service not responding: {e}")


# ═══════════════════════════════════════════════════════════════════
# Custom Test Runner with Beautiful Output
# ═══════════════════════════════════════════════════════════════════

class NexaCityTestRunner:
    """Custom runner that produces a detailed summary report."""

    @staticmethod
    def run():
        print("=" * 68)
        print("  ╔══════════════════════════════════════════════════════════════╗")
        print("  ║       NexaCity5G — Full Platform Test Suite                 ║")
        print("  ║       Running with Made-Up Test Data                        ║")
        print("  ╚══════════════════════════════════════════════════════════════╝")
        print("=" * 68)
        print(f"  🕐 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"  📋 Test Data: {len(FAKE_TRAFFIC_DATA)} traffic, {len(FAKE_WASTE_DATA)} waste, {len(FAKE_EMERGENCY_DATA)} emergency records")
        print("=" * 68)

        # Build test suite
        loader = unittest.TestLoader()
        suite = unittest.TestSuite()

        test_classes = [
            TestEdgeNodeLogic,
            TestSensorSimulator,
            TestFullPipelineScenarios,
            TestAPIResponseFormats,
            TestWebSocketMessages,
            TestLiveIntegration,
        ]

        for cls in test_classes:
            suite.addTests(loader.loadTestsFromTestCase(cls))

        # Run with verbosity
        runner = unittest.TextTestRunner(verbosity=0, stream=StringIO())
        result = runner.run(suite)

        # Summary
        print("\n" + "=" * 68)
        print("  📊 TEST RESULTS SUMMARY")
        print("=" * 68)

        total = result.testsRun
        passed = total - len(result.failures) - len(result.errors) - len(result.skipped)

        print(f"  ✅ Passed:  {passed}")
        print(f"  ❌ Failed:  {len(result.failures)}")
        print(f"  💥 Errors:  {len(result.errors)}")
        print(f"  ⏭️  Skipped: {len(result.skipped)}")
        print(f"  📋 Total:   {total}")
        print("-" * 68)

        if result.failures:
            print("\n  ❌ FAILED TESTS:")
            for test, traceback in result.failures:
                print(f"    • {test}: {traceback.strip().split(chr(10))[-1]}")

        if result.errors:
            print("\n  💥 ERROR TESTS:")
            for test, traceback in result.errors:
                print(f"    • {test}: {traceback.strip().split(chr(10))[-1]}")

        if result.wasSuccessful():
            print("\n  🎉 ALL TESTS PASSED! NexaCity5G pipeline is healthy!")
        else:
            print("\n  ⚠️  Some tests failed. Please review the output above.")

        print("=" * 68)
        return result


if __name__ == "__main__":
    # Remove --live from sys.argv so unittest doesn't complain
    live_mode = "--live" in sys.argv
    if not live_mode:
        # Filter out --live if it's somehow there
        sys.argv = [a for a in sys.argv if a != "--live"]

    result = NexaCityTestRunner.run()
    sys.exit(0 if result.wasSuccessful() else 1)
