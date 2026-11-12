-- Idempotent quota migration. Per-day usage timestamps use UTC.
CREATE TABLE IF NOT EXISTS ai_daily_gate (
 day date PRIMARY KEY DEFAULT (now() AT TIME ZONE 'UTC')::date,
 calls integer NOT NULL DEFAULT 0 CHECK (calls >= 0)
);
CREATE TABLE IF NOT EXISTS ai_usage (
 day date NOT NULL,
 provider text NOT NULL CHECK(provider IN ('openrouter','gemini')),
 calls integer NOT NULL DEFAULT 0 CHECK (calls >= 0),
 prompt_tokens bigint NOT NULL DEFAULT 0,
 completion_tokens bigint NOT NULL DEFAULT 0,
 blocked_until timestamptz,
 PRIMARY KEY (day,provider)
);
CREATE OR REPLACE FUNCTION reserve_ai_call(p_provider text,p_total_limit int,p_provider_limit int)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_day date := (now() AT TIME ZONE 'UTC')::date; v_total integer; v_calls integer; v_blocked timestamptz;
BEGIN
 IF p_provider NOT IN ('openrouter','gemini') OR p_total_limit<1 OR p_provider_limit<1
 THEN RETURN jsonb_build_object('allowed',false,'reason','invalid_configuration'); END IF;
 INSERT INTO ai_daily_gate(day,calls) VALUES(v_day,0) ON CONFLICT(day) DO NOTHING;
 SELECT calls INTO v_total FROM ai_daily_gate WHERE day=v_day FOR UPDATE;
 IF v_total>=p_total_limit THEN RETURN jsonb_build_object('allowed',false,'reason','daily_total_limit'); END IF;
 INSERT INTO ai_usage(day,provider,calls) VALUES(v_day,p_provider,0) ON CONFLICT(day,provider) DO NOTHING;
 SELECT calls,blocked_until INTO v_calls,v_blocked FROM ai_usage WHERE day=v_day AND provider=p_provider FOR UPDATE;
 IF v_blocked IS NOT NULL AND v_blocked>now()
 THEN RETURN jsonb_build_object('allowed',false,'reason','provider_cooldown','until',v_blocked); END IF;
 IF v_calls>=p_provider_limit THEN RETURN jsonb_build_object('allowed',false,'reason','provider_daily_limit'); END IF;
 UPDATE ai_daily_gate SET calls=calls+1 WHERE day=v_day;
 UPDATE ai_usage SET calls=calls+1 WHERE day=v_day AND provider=p_provider;
 RETURN jsonb_build_object('allowed',true,'remaining',p_total_limit-v_total-1);
END $$;
CREATE OR REPLACE FUNCTION record_ai_usage(p_provider text,p_input bigint,p_output bigint)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 UPDATE ai_usage SET prompt_tokens=prompt_tokens+greatest(p_input,0),completion_tokens=completion_tokens+greatest(p_output,0)
 WHERE day=(now() AT TIME ZONE 'UTC')::date AND provider=p_provider;
END $$;
CREATE OR REPLACE FUNCTION cooldown_ai_provider(p_provider text,p_seconds integer)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 UPDATE ai_usage SET blocked_until=now()+(least(greatest(p_seconds,30),7200)||' seconds')::interval
 WHERE day=(now() AT TIME ZONE 'UTC')::date AND provider=p_provider;
END $$;
