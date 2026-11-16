-- El mismo asesor no puede tener una actividad y una visita simultáneas.
-- El bloqueo transaccional cubre ambas tablas y se libera al confirmar o revertir.
CREATE FUNCTION crm_agenda_validar_solape() RETURNS trigger
LANGUAGE plpgsql VOLATILE AS $$
BEGIN
  IF NEW.estado <> 'PROGRAMADA' OR NEW.asignado_usuario_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (OLD.organizacion_id, OLD.asignado_usuario_id, OLD.estado,
        OLD.programada_en, OLD.programada_fin)
       IS NOT DISTINCT FROM
       (NEW.organizacion_id, NEW.asignado_usuario_id, NEW.estado,
        NEW.programada_en, NEW.programada_fin) THEN
      RETURN NEW;
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'crm:agenda:' || NEW.organizacion_id::text || ':' || NEW.asignado_usuario_id::text, 0
  ));

  IF EXISTS (
    SELECT 1 FROM lead_actividades a
    WHERE a.organizacion_id = NEW.organizacion_id
      AND a.asignado_usuario_id = NEW.asignado_usuario_id
      AND a.estado = 'PROGRAMADA'
      AND (TG_TABLE_NAME <> 'lead_actividades' OR a.id <> NEW.id)
      AND a.programada_en < NEW.programada_fin AND a.programada_fin > NEW.programada_en
  ) OR EXISTS (
    SELECT 1 FROM lead_visitas v
    WHERE v.organizacion_id = NEW.organizacion_id
      AND v.asignado_usuario_id = NEW.asignado_usuario_id
      AND v.estado = 'PROGRAMADA'
      AND (TG_TABLE_NAME <> 'lead_visitas' OR v.id <> NEW.id)
      AND v.programada_en < NEW.programada_fin AND v.programada_fin > NEW.programada_en
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'CRM_AGENDA_SOLAPE';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER crm_agenda_actividad_solape
BEFORE INSERT OR UPDATE OF organizacion_id, asignado_usuario_id, estado, programada_en, programada_fin
ON lead_actividades FOR EACH ROW EXECUTE FUNCTION crm_agenda_validar_solape();

CREATE TRIGGER crm_agenda_visita_solape
BEFORE INSERT OR UPDATE OF organizacion_id, asignado_usuario_id, estado, programada_en, programada_fin
ON lead_visitas FOR EACH ROW EXECUTE FUNCTION crm_agenda_validar_solape();
