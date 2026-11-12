-- Apply after database/free-provider-quota.sql; non-destructive additions.
CREATE TABLE IF NOT EXISTS agent_credentials (
 provider text PRIMARY KEY CHECK(provider IN ('openrouter','gemini','deepseek','openai')),
 secret_cipher text NOT NULL,
 key_hint text NOT NULL,
 enabled boolean NOT NULL DEFAULT true,
 allow_paid boolean NOT NULL DEFAULT false,
 free_tier_confirmed boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_provider_daily (
 day date NOT NULL,
 provider text NOT NULL CHECK(provider IN ('openrouter','gemini','deepseek','openai')),
 calls integer NOT NULL DEFAULT 0 CHECK(calls>=0),
 prompt_tokens bigint NOT NULL DEFAULT 0,
 completion_tokens bigint NOT NULL DEFAULT 0,
 blocked_until timestamptz,
 PRIMARY KEY(day,provider)
);
INSERT INTO agent_provider_daily(day,provider,calls,prompt_tokens,completion_tokens,blocked_until)
SELECT day,provider,calls,prompt_tokens,completion_tokens,blocked_until FROM ai_usage
ON CONFLICT(day,provider) DO NOTHING;
CREATE TABLE IF NOT EXISTS agent_role_runs (
 project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 stage integer NOT NULL CHECK(stage>=0 AND stage<5),
 role text NOT NULL,
 provider text,
 model text,
 status text NOT NULL DEFAULT 'running',
 output jsonb,
 error text,
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 PRIMARY KEY(project_id,stage,role)
);
CREATE OR REPLACE FUNCTION reserve_agent_call(p_provider text,p_total_limit int,p_provider_limit int)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_day date:=(now() AT TIME ZONE 'UTC')::date;v_total integer;v_calls integer;v_blocked timestamptz;
BEGIN
 IF p_provider NOT IN ('openrouter','gemini','deepseek','openai') OR p_total_limit<1 OR p_provider_limit<1
 THEN RETURN jsonb_build_object('allowed',false,'reason','invalid_configuration');END IF;
 INSERT INTO ai_daily_gate(day,calls) VALUES(v_day,0) ON CONFLICT(day) DO NOTHING;
 SELECT calls INTO v_total FROM ai_daily_gate WHERE day=v_day FOR UPDATE;
 IF v_total>=p_total_limit THEN RETURN jsonb_build_object('allowed',false,'reason','daily_total_limit');END IF;
 INSERT INTO agent_provider_daily(day,provider,calls) VALUES(v_day,p_provider,0)
 ON CONFLICT(day,provider) DO NOTHING;
 SELECT calls,blocked_until INTO v_calls,v_blocked FROM agent_provider_daily
 WHERE day=v_day AND provider=p_provider FOR UPDATE;
 IF v_blocked IS NOT NULL AND v_blocked>now()
 THEN RETURN jsonb_build_object('allowed',false,'reason','provider_cooldown');END IF;
 IF v_calls>=p_provider_limit
 THEN RETURN jsonb_build_object('allowed',false,'reason','provider_daily_limit');END IF;
 UPDATE ai_daily_gate SET calls=calls+1 WHERE day=v_day;
 UPDATE agent_provider_daily SET calls=calls+1 WHERE day=v_day AND provider=p_provider;
 RETURN jsonb_build_object('allowed',true,'remaining',p_total_limit-v_total-1);
END $$;
CREATE OR REPLACE FUNCTION record_agent_tokens(p_provider text,p_input bigint,p_output bigint)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 UPDATE agent_provider_daily SET prompt_tokens=prompt_tokens+greatest(p_input,0),
 completion_tokens=completion_tokens+greatest(p_output,0)
 WHERE day=(now() AT TIME ZONE 'UTC')::date AND provider=p_provider;
END $$;
CREATE OR REPLACE FUNCTION cooldown_agent_provider(p_provider text,p_seconds integer)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 UPDATE agent_provider_daily SET blocked_until=now()+(least(greatest(p_seconds,30),7200)||' seconds')::interval
 WHERE day=(now() AT TIME ZONE 'UTC')::date AND provider=p_provider;
END $$;
