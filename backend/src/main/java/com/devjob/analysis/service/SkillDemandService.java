package com.devjob.analysis.service;

import com.devjob.analysis.dto.SkillDemand;
import com.devjob.analysis.dto.SkillDemandPage;
import com.devjob.analysis.dto.SkillDemandQuery;
import com.devjob.skill.dto.SkillResponse;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class SkillDemandService {
    private final EntityManager entities;
    public SkillDemandService(EntityManager entities) { this.entities = entities; }

    public SkillDemandPage find(SkillDemandQuery input) {
        input.validate();
        String filter = " where a.status = com.devjob.analysis.entity.AIAnalysis.Status.COMPLETED";
        if (input.from() != null) filter += " and j.postedDate >= :dateFrom";
        if (input.to() != null) filter += " and j.postedDate <= :dateTo";
        if (input.desiredRole() != null) filter += " and locate(:desiredRole, lower(j.title)) > 0";

        long analyzed = ((Number) bind(entities.createQuery("select count(a.id) from AIAnalysis a join a.job j" + filter), input)
                .getSingleResult()).longValue();
        String skills = " from JobSkill js join AIAnalysis a on a.job = js.job join a.job j" + filter;
        long total = ((Number) bind(entities.createQuery("select count(distinct js.skill.id)" + skills), input)
                .getSingleResult()).longValue();
        var rows = bind(entities.createQuery("select js.skill.id, js.skill.name, count(js.id)" + skills
                + " group by js.skill.id, js.skill.name order by count(js.id) desc, js.skill.name asc, js.skill.id asc", Object[].class), input)
                .setFirstResult(input.page() * input.size()).setMaxResults(input.size()).getResultList();
        var items = rows.stream().map(row -> {
            long count = ((Number) row[2]).longValue();
            return new SkillDemand(new SkillResponse(((Number) row[0]).longValue(), (String) row[1]),
                    count, analyzed, analyzed == 0 ? 0 : (double) count / analyzed);
        }).toList();
        return new SkillDemandPage(items, input.page(), input.size(), total, analyzed);
    }

    private <T extends Query> T bind(T query, SkillDemandQuery input) {
        if (input.from() != null) query.setParameter("dateFrom", input.from());
        if (input.to() != null) query.setParameter("dateTo", input.to());
        if (input.desiredRole() != null) query.setParameter("desiredRole", input.desiredRole().toLowerCase(Locale.ROOT));
        return query;
    }
}
