# gameplay-v3: Public Character Data Patch

This patch updates four files: CharacterInfoComponent.h/.cpp and CharacterStatsComponent.h/.cpp. It builds on the previous fixes for OutLifetimeProps. Keep the previously fixed SkillsDataComponent.cpp with CheckCondition instead of check.

No Node.js changes, database reset or new seed are needed.

## 1. Install and compile

1. Close Unreal Editor.
2. Replace the four files in Source/mu_test_one (or their existing Public/Private folders) with the files under ue/ in this archive. Do not leave duplicate class files in Source.
3. Optionally copy ue/Tests/CharacterPublicDataTests.cpp into Source/mu_test_one/Tests.
4. Build mu_test_oneEditor / Development Editor / Win64 normally. These are reflected header changes; do not use Live Coding for this installation.
5. Reopen the editor. Compile the affected Blueprints. Existing component instances do not need to be removed and added again.

## 2. What changed

CharacterInfo now sends a dedicated public structure to clients for which the actor is network-relevant. It contains id, level, classId, reputation, characterName, characterTitle, staff, clan, alliance, race and faction. Existing Blueprint getters expose these values after receipt.

The private character snapshot, inventory, learned skills, currency, isSaving and needsReload remain owner-only. Remote actors and monsters do not need a private snapshot or the skill/item catalog to expose their public information.

CharacterStats sends current and maximum values for HP, CP, MP, energy, rage and energy shield in a public resource structure. The full effective combat stats remain owner-only. Existing currentResources and the resource fields in effectiveStats remain available for both local and remote actors. Other effectiveStats fields on a remote non-owned actor are not provided; do not use them to inspect another actor's combat stats.

The new maxResources getter explicitly exposes the public resource maxima. Damage, healing, resource spending, modifier changes and stat recalculation publish resource updates from the server. Clients cannot change authoritative resources using those methods.

The current/maximum pair is read from the same public structure regardless of arrival order relative to the owner-only combat payload. A separate initialized flag makes a valid all-zero/dead state distinguishable from data that has not arrived.

## 3. Initialize the existing name overlay once

New CharacterInfo Blueprint API:

- OnPublicInfoReady: no arguments; emitted once per component instance, after its public getters are populated. Works for monsters, the local player and other players. Also emitted locally on a listen server/standalone game.
- IsPublicInfoReady: query for initial data that arrived before an event was bound.
- OnPublicInfoChanged: optional notification for later changes. Do not use it to repeatedly call your one-time Init Ref.

Keep initCharacterNameOverlay, Init Ref, Refresh and ToggleSelect as they are. Move only the places that trigger the initial overlay setup:

1. In BP_BaseCharacter, add a custom event TryInitNameOverlay in the Event Graph.
2. In that event, return if Is Dedicated Server is true. The host of a listen server must still display the overlay, so do not use Has Authority as the UI filter.
3. Check CharacterInfo.IsPublicInfoReady.
4. Check that the Widget Component's Get User Widget Object is valid. If needed, call Init Widget on the Widget Component before obtaining the object again.
5. Only after both checks pass, use Do Once, then call the existing initCharacterNameOverlay.
6. In the base character's BeginPlay flow, bind CharacterInfo.OnPublicInfoReady to TryInitNameOverlay FIRST, then call TryInitNameOverlay once immediately to handle data received before the binding.
7. Keep any existing base BeginPlay logic. If a child overrides Event BeginPlay, ensure its Parent: BeginPlay runs so this shared setup executes before the child's loading flow.

Remove the old direct overlay call from the enemy's configure and from the player's CharacterInfo.OnDataLoaded handler. Keep their other operations. The shared event/query path now initializes the overlay on each machine that displays the actor; keeping the old calls would bypass Do Once and could initialize twice.

If your Widget Component is assigned or created later than BeginPlay, call TryInitNameOverlay after that assignment as well. Do Once must be AFTER the validity checks; an early failed attempt must not consume it.

Do not make overlay setup or ToggleSelect a Multicast RPC. Selection/decal state is local to the player looking at the target.

The event is once per component instance, not once per subscriber. The bind-then-query pattern and Blueprint Do Once cover both an early network delivery and a late subscription. A destroyed and respawned actor gets a fresh component and a fresh initialization.

## 4. Keep the existing data loading paths

- Player: retain CharacterInfo.loadFromApi(characterId, false) on the authoritative server. It loads the combined character state and applies stats; do not also call CharacterStats.loadFromApi for that player.
- Enemy: keep configure called by the server spawn manager, including CharacterInfo.loadFromCache(..., true, level) and CharacterStats.loadFromCache(..., true, level), their success checks, isAlive=true and the return value. These cache calls remain synchronous. Only the direct overlay call moves to the shared client-ready flow.
- If the shared loadCharacterData function also supports uncached monsters, keep both monster API calls under its isMonster branch.
- Keep HTTP/cache loading behind Has Authority. Do not put the UI event bindings behind that same authority check.
- InventoryComponent and SkillsDataComponent are required only on the player in this setup.

For the first single-player network test, character ID 1 may be assigned on the server. Multiple test clients must use different character records. A login/session system is still separate.

## 5. Resource bars

New CharacterStats Blueprint API:

- IsResourcesReady: true when initial current and maximum resource data is available.
- OnResourcesChanged: emitted after current/maximum mirrors are populated and on subsequent changes. This updates bar values; it must not recreate the name widget or reset selection.
- maxResources: public maximum HP/CP/MP/energy/rage/energyShield.

Existing bindings that read currentResources.hp and effectiveStats.hp can remain. For event-driven bars, bind OnResourcesChanged and then perform an initial update if IsResourcesReady is true. If the widget itself is created later, read current values when creating it. Clamp/divide safely when a maximum is zero.

Info and resource components can become ready in either order. OnPublicInfoReady means the name/title fields are ready; it is not a promise that resource bars or the private inventory are ready. Private player widgets continue using IsReady/OnStateChanged, and resource widgets use IsResourcesReady/OnResourcesChanged.

OnDataLoaded retains its data-loading role. It is not the public actor-ready event for remote enemies. IsReady remains the private player snapshot/catalog check; use IsPublicInfoReady for the shared name overlay.

## 6. Blueprint state outside these components

The existing Blueprint isAlive variable is not automatically connected to HP or replicated by this patch. If clients read it, mark it Replicated (or RepNotify when a visual death reaction is needed), and set it on the server. The existing configure assignment is preserved. Death/respawn behavior remains your gameplay logic.

The placeholder Set 3D Model function is not changed. Model and animation selection are not implemented by this patch. The server calls configure; it is not automatically called on clients. Future model selection will need its own replicated presentation data.

Actor Replicates must be enabled. Spawn monsters on the server. The player's Pawn must be possessed/owned by its PlayerController for existing player RPCs to work. This patch does not make unrelated combat/movement Blueprint logic network-authoritative automatically.

## 7. Verification

Unreal Engine is not installed in the preparation environment. UHT, Editor compilation, the included Automation tests and actual network PIE were NOT run here. Source changes were reviewed against the current gameplay-v3 files, including all resource mutation methods and the existing isMonster/cache paths.

Optional Automation tests in this patch:

- Mu.Network.PublicInfoMirrors: public name/title/clan fields without a private snapshot; preservation of private currency.
- Mu.Network.PublicResourceMirrors: an all-zero initialized state, public current/max getters, and both arrival orders of public resources versus owner-only combat stats.

These tests simulate delivery to RepNotify; they do not test real network transport or Blueprint wiring. After compiling, verify with network PIE: one server and one client, a player plus an enemy, correct names and HP bars, server-side damage reflected on the client, selection remaining intact, and a late-spawned enemy initializing its overlay once. Also check a listen-server host if using that mode.

Implementation references:

- https://dev.epicgames.com/documentation/unreal-engine/replicate-actor-properties-in-unreal-engine
- https://dev.epicgames.com/documentation/unreal-engine/replicated-object-execution-order-in-unreal-engine
